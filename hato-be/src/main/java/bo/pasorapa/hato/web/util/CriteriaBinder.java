package bo.pasorapa.hato.web.util;

import bo.pasorapa.hato.service.filter.filters.BooleanFilter;
import bo.pasorapa.hato.service.filter.filters.EnumFilter;
import bo.pasorapa.hato.service.filter.filters.Filter;
import bo.pasorapa.hato.service.filter.filters.LocalDateFilter;
import bo.pasorapa.hato.service.filter.filters.LongFilter;
import bo.pasorapa.hato.service.filter.filters.RangeFilter;
import bo.pasorapa.hato.service.filter.filters.StringFilter;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.UriInfo;
import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

public final class CriteriaBinder {

    private CriteriaBinder() {
    }

    public static final class BinderHints {
        private final Map<String, Class<? extends Enum<?>>> enumFields = new HashMap<>();
        private final Map<Class<?>, Function<String, ?>> customParsers = new HashMap<>();
        private boolean enumCaseInsensitive = true;

        public BinderHints registerEnum(String fieldName, Class<? extends Enum<?>> enumClass) {
            enumFields.put(fieldName, enumClass);
            return this;
        }

        public <T> BinderHints registerParser(Class<T> type, Function<String, T> parser) {
            customParsers.put(type, parser);
            return this;
        }
    }

    private static final Map<Class<?>, Function<String, ?>> DEFAULT_PARSERS = Map.ofEntries(
            Map.entry(Long.class, Long::valueOf),
            Map.entry(Boolean.class, CriteriaBinder::parseStrictBoolean),
            Map.entry(String.class, value -> value),
            Map.entry(LocalDate.class, value -> LocalDate.parse(value, DateTimeFormatter.ISO_LOCAL_DATE)),
            Map.entry(UUID.class, UUID::fromString)
    );

    public static <C> C bind(UriInfo uriInfo, Class<C> criteriaClass, BinderHints hints) {
        try {
            C criteria = criteriaClass.getDeclaredConstructor().newInstance();
            MultivaluedMap<String, String> query = uriInfo.getQueryParameters();

            for (Field field : criteriaClass.getDeclaredFields()) {
                Class<?> filterType = field.getType();
                if (!Filter.class.isAssignableFrom(filterType)) {
                    continue;
                }

                String fieldName = field.getName();
                Object filter = filterType.getDeclaredConstructor().newInstance();
                Class<?> valueType = detectValueType(filterType, fieldName, hints);

                setIfPresent(query, fieldName + ".equals", value -> call(filter, "setEquals", valueOrEnum(valueType, value, hints)));
                setIfPresent(query, fieldName + ".notEquals", value -> call(filter, "setNotEquals", valueOrEnum(valueType, value, hints)));
                setIfPresent(query, fieldName + ".specified", value -> call(filter, "setSpecified", parse(Boolean.class, value, hints)));
                setIfPresent(query, fieldName + ".in", value -> call(filter, "setIn", parseList(valueType, value, hints)));

                if (StringFilter.class.isAssignableFrom(filterType)) {
                    setIfPresent(query, fieldName + ".contains", value -> call(filter, "setContains", value));
                }
                if (RangeFilter.class.isAssignableFrom(filterType)) {
                    setIfPresent(query, fieldName + ".greaterThan", value -> call(filter, "setGreaterThan", valueOrEnum(valueType, value, hints)));
                    setIfPresent(query, fieldName + ".lessThan", value -> call(filter, "setLessThan", valueOrEnum(valueType, value, hints)));
                    setIfPresent(query, fieldName + ".greaterThanOrEqual", value -> call(filter, "setGreaterThanOrEqual", valueOrEnum(valueType, value, hints)));
                    setIfPresent(query, fieldName + ".lessThanOrEqual", value -> call(filter, "setLessThanOrEqual", valueOrEnum(valueType, value, hints)));
                }

                if (invokeHasValues(filter)) {
                    callSetter(criteria, fieldName, filter);
                }
            }
            return criteria;
        } catch (Exception exception) {
            throw new IllegalArgumentException("Error binding criteria " + criteriaClass.getSimpleName(), exception);
        }
    }

    private static boolean invokeHasValues(Object filter) {
        try {
            Method method = filter.getClass().getMethod("hasValues");
            return (Boolean) method.invoke(filter);
        } catch (Exception exception) {
            return true;
        }
    }

    private static void setIfPresent(MultivaluedMap<String, String> query, String key, java.util.function.Consumer<String> setter) {
        String value = query.getFirst(key);
        if (value != null && !value.isBlank()) {
            setter.accept(value);
        }
    }

    private static Object valueOrEnum(Class<?> valueType, String raw, BinderHints hints) {
        if (Enum.class.isAssignableFrom(valueType)) {
            @SuppressWarnings("unchecked")
            Class<? extends Enum<?>> enumClass = (Class<? extends Enum<?>>) valueType;
            return parseEnum((Class) enumClass, raw, hints.enumCaseInsensitive);
        }
        return parse(valueType, raw, hints);
    }

    @SuppressWarnings("unchecked")
    private static <T> List<T> parseList(Class<T> valueType, String csv, BinderHints hints) {
        List<T> values = new ArrayList<>();
        for (String part : csv.split(",")) {
            String item = part.trim();
            if (!item.isEmpty()) {
                values.add((T) valueOrEnum(valueType, item, hints));
            }
        }
        return values;
    }

    @SuppressWarnings("unchecked")
    private static <T> T parse(Class<T> type, String raw, BinderHints hints) {
        Function<String, ?> custom = hints.customParsers.get(type);
        if (custom != null) {
            return (T) custom.apply(raw);
        }
        Function<String, ?> parser = DEFAULT_PARSERS.get(type);
        if (parser != null) {
            return (T) parser.apply(raw);
        }
        throw new IllegalArgumentException("No parser for type " + type.getName());
    }

    private static <E extends Enum<E>> E parseEnum(Class<E> enumClass, String raw, boolean caseInsensitive) {
        if (!caseInsensitive) {
            return Enum.valueOf(enumClass, raw);
        }
        for (E constant : enumClass.getEnumConstants()) {
            if (constant.name().equalsIgnoreCase(raw)) {
                return constant;
            }
        }
        throw new IllegalArgumentException("Valor enum inválido '" + raw + "' para " + enumClass.getSimpleName());
    }

    private static Class<?> detectValueType(Class<?> filterType, String fieldName, BinderHints hints) {
        if (LongFilter.class.isAssignableFrom(filterType)) {
            return Long.class;
        }
        if (BooleanFilter.class.isAssignableFrom(filterType)) {
            return Boolean.class;
        }
        if (StringFilter.class.isAssignableFrom(filterType)) {
            return String.class;
        }
        if (bo.pasorapa.hato.service.filter.filters.UuidFilter.class.isAssignableFrom(filterType)) {
            return UUID.class;
        }
        if (LocalDateFilter.class.isAssignableFrom(filterType)) {
            return LocalDate.class;
        }
        if (EnumFilter.class.isAssignableFrom(filterType)) {
            Class<? extends Enum<?>> enumClass = hints.enumFields.get(fieldName);
            if (enumClass == null) {
                throw new IllegalStateException("EnumFilter para campo '" + fieldName + "' requiere registro en BinderHints");
            }
            return enumClass;
        }
        return String.class;
    }

    private static void call(Object target, String methodName, Object arg) {
        try {
            if (arg instanceof List<?> list) {
                Method method = target.getClass().getMethod(methodName, List.class);
                method.invoke(target, list);
                return;
            }
            Method method = findCompatibleMethod(target.getClass(), methodName, arg.getClass());
            method.invoke(target, arg);
        } catch (Exception exception) {
            throw new IllegalArgumentException("Error llamando " + methodName + " en " + target.getClass().getName(), exception);
        }
    }

    private static Method findCompatibleMethod(Class<?> targetClass, String methodName, Class<?> argType) throws NoSuchMethodException {
        for (Method method : targetClass.getMethods()) {
            if (method.getName().equals(methodName)
                    && method.getParameterCount() == 1
                    && method.getParameterTypes()[0].isAssignableFrom(argType)) {
                return method;
            }
        }
        return targetClass.getMethod(methodName, argType);
    }

    private static Boolean parseStrictBoolean(String raw) {
        if ("true".equalsIgnoreCase(raw)) {
            return true;
        }
        if ("false".equalsIgnoreCase(raw)) {
            return false;
        }
        throw new IllegalArgumentException("Valor booleano inválido '" + raw + "'. Usá true o false.");
    }

    private static void callSetter(Object target, String fieldName, Object value) throws Exception {
        String setterName = "set" + Character.toUpperCase(fieldName.charAt(0)) + fieldName.substring(1);
        Method method = target.getClass().getMethod(setterName, value.getClass());
        method.invoke(target, value);
    }
}

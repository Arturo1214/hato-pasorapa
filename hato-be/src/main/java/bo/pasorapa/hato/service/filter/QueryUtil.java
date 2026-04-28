package bo.pasorapa.hato.service.filter;

import bo.pasorapa.hato.service.filter.filters.EnumFilter;
import bo.pasorapa.hato.service.filter.filters.Filter;
import bo.pasorapa.hato.service.filter.filters.RangeFilter;
import bo.pasorapa.hato.service.filter.filters.StringFilter;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.io.Serializable;
import java.util.ArrayList;
import java.util.List;

public final class QueryUtil {

    private QueryUtil() {
    }

    public static <T extends Serializable, F extends Filter<T>> void addPredicate(
            List<Predicate> predicates,
            CriteriaBuilder cb,
            Root<?> root,
            String fieldName,
            F filter
    ) {
        addPredicate(predicates, cb, root.get(fieldName), filter);
    }

    public static <T extends Serializable, F extends Filter<T>> void addPredicate(
            List<Predicate> predicates,
            CriteriaBuilder cb,
            Path<T> field,
            F filter
    ) {
        if (filter != null) {
            predicates.add(combinePredicatesAnd(cb, buildPredicatesForFilter(cb, field, filter)));
        }
    }

    public static <X extends Comparable<? super X> & Serializable, F extends RangeFilter<X>> void addPredicateRange(
            List<Predicate> predicates,
            CriteriaBuilder cb,
            Root<?> root,
            String fieldName,
            F filter
    ) {
        if (filter != null) {
            predicates.add(combinePredicatesAnd(cb, buildPredicatesForRangeFilter(cb, root.get(fieldName), filter)));
        }
    }

    public static void addPredicateString(
            List<Predicate> predicates,
            CriteriaBuilder cb,
            Root<?> root,
            String fieldName,
            StringFilter filter
    ) {
        if (filter != null) {
            predicates.add(combinePredicatesAnd(cb, buildPredicatesForStringFilter(cb, root.get(fieldName), filter)));
        }
    }

    public static <E extends Enum<E> & Serializable> void addPredicateEnum(
            List<Predicate> predicates,
            CriteriaBuilder cb,
            Root<?> root,
            String fieldName,
            EnumFilter<E> filter
    ) {
        if (filter != null) {
            predicates.add(combinePredicatesAnd(cb, buildPredicatesForFilter(cb, root.get(fieldName), filter)));
        }
    }

    public static <T extends Serializable> List<Predicate> buildPredicatesForFilter(
            CriteriaBuilder cb,
            Path<T> field,
            Filter<T> filter
    ) {
        List<Predicate> predicates = new ArrayList<>();
        if (filter == null) {
            return predicates;
        }

        if (filter.getSpecified() != null) {
            predicates.add(Boolean.TRUE.equals(filter.getSpecified()) ? cb.isNotNull(field) : cb.isNull(field));
        }
        if (filter.getEquals() != null) {
            predicates.add(cb.equal(field, filter.getEquals()));
        }
        if (filter.getNotEquals() != null) {
            predicates.add(cb.notEqual(field, filter.getNotEquals()));
        }
        if (filter.getIn() != null && !filter.getIn().isEmpty()) {
            predicates.add(field.in(filter.getIn()));
        }
        return predicates;
    }

    public static List<Predicate> buildPredicatesForStringFilter(
            CriteriaBuilder cb,
            Path<String> field,
            StringFilter filter
    ) {
        List<Predicate> predicates = buildPredicatesForFilter(cb, field, filter);
        if (filter != null && filter.getContains() != null && !filter.getContains().isBlank()) {
            predicates.add(cb.like(cb.lower(field), "%" + filter.getContains().toLowerCase() + "%"));
        }
        return predicates;
    }

    public static <T extends Comparable<? super T> & Serializable> List<Predicate> buildPredicatesForRangeFilter(
            CriteriaBuilder cb,
            Path<T> field,
            RangeFilter<T> filter
    ) {
        List<Predicate> predicates = buildPredicatesForFilter(cb, field, filter);
        if (filter == null) {
            return predicates;
        }

        if (filter.getGreaterThanOrEqual() != null) {
            predicates.add(cb.greaterThanOrEqualTo(field, filter.getGreaterThanOrEqual()));
        }
        if (filter.getGreaterThan() != null) {
            predicates.add(cb.greaterThan(field, filter.getGreaterThan()));
        }
        if (filter.getLessThanOrEqual() != null) {
            predicates.add(cb.lessThanOrEqualTo(field, filter.getLessThanOrEqual()));
        }
        if (filter.getLessThan() != null) {
            predicates.add(cb.lessThan(field, filter.getLessThan()));
        }
        return predicates;
    }

    public static Predicate combinePredicatesAnd(CriteriaBuilder cb, List<Predicate> predicates) {
        return cb.and(predicates.toArray(new Predicate[0]));
    }
}

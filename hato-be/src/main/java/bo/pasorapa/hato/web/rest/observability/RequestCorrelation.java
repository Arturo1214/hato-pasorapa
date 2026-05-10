package bo.pasorapa.hato.web.rest.observability;

import java.util.Optional;
import org.jboss.logmanager.MDC;

public final class RequestCorrelation {

    public static final String REQUEST_ID_HEADER = "X-Request-Id";
    public static final String CORRELATION_ID_HEADER = "X-Correlation-Id";
    public static final String ERROR_ID_HEADER = "X-Error-Id";
    public static final String REQUEST_ID_MDC_KEY = "request.id";
    public static final String REQUEST_METHOD_MDC_KEY = "request.method";
    public static final String REQUEST_PATH_MDC_KEY = "request.path";
    public static final String REQUEST_ID_PROPERTY = RequestCorrelation.class.getName() + ".requestId";
    public static final String REQUEST_START_NANOS_PROPERTY = RequestCorrelation.class.getName() + ".requestStartNanos";
    public static final String API_REQUEST_PROPERTY = RequestCorrelation.class.getName() + ".apiRequest";

    private RequestCorrelation() {
    }

    public static String currentRequestId() {
        return currentValue(REQUEST_ID_MDC_KEY);
    }

    public static String currentMethod() {
        return currentValue(REQUEST_METHOD_MDC_KEY);
    }

    public static String currentPath() {
        return currentValue(REQUEST_PATH_MDC_KEY);
    }

    private static String currentValue(String key) {
        return Optional.ofNullable(MDC.get(key))
                .map(Object::toString)
                .filter(value -> !value.isBlank())
                .orElse(null);
    }
}

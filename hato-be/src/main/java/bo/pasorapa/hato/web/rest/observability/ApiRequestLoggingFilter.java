package bo.pasorapa.hato.web.rest.observability;

import jakarta.annotation.Priority;
import jakarta.ws.rs.Priorities;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.container.ContainerResponseContext;
import jakarta.ws.rs.container.ContainerResponseFilter;
import jakarta.ws.rs.container.PreMatching;
import jakarta.ws.rs.ext.Provider;
import java.io.IOException;
import java.net.URI;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import org.jboss.logging.Logger;
import org.jboss.logmanager.MDC;

@Provider
@PreMatching
@Priority(Priorities.AUTHENTICATION - 10)
public class ApiRequestLoggingFilter implements ContainerRequestFilter, ContainerResponseFilter {

    private static final Logger LOG = Logger.getLogger(ApiRequestLoggingFilter.class);

    @Override
    public void filter(ContainerRequestContext requestContext) throws IOException {
        String path = normalizedPath(requestContext.getUriInfo().getRequestUri());
        if (!isApiRequest(path)) {
            return;
        }

        String requestId = resolveRequestId(requestContext);
        requestContext.setProperty(RequestCorrelation.API_REQUEST_PROPERTY, Boolean.TRUE);
        requestContext.setProperty(RequestCorrelation.REQUEST_ID_PROPERTY, requestId);
        requestContext.setProperty(RequestCorrelation.REQUEST_START_NANOS_PROPERTY, System.nanoTime());

        MDC.put(RequestCorrelation.REQUEST_ID_MDC_KEY, requestId);
        MDC.put(RequestCorrelation.REQUEST_METHOD_MDC_KEY, requestContext.getMethod());
        MDC.put(RequestCorrelation.REQUEST_PATH_MDC_KEY, path);

        LOG.infof(
                "HTTP request started %s %s summary={queryKeys=%s, contentType=%s, contentLength=%s}",
                requestContext.getMethod(),
                path,
                sanitizedQueryKeys(requestContext),
                headerValueOrDash(requestContext, "Content-Type"),
                headerValueOrDash(requestContext, "Content-Length"));
    }

    @Override
    public void filter(ContainerRequestContext requestContext, ContainerResponseContext responseContext) throws IOException {
        if (!Boolean.TRUE.equals(requestContext.getProperty(RequestCorrelation.API_REQUEST_PROPERTY))) {
            return;
        }

        String requestId = stringProperty(requestContext, RequestCorrelation.REQUEST_ID_PROPERTY);
        String path = normalizedPath(requestContext.getUriInfo().getRequestUri());
        long durationMs = durationMs(requestContext.getProperty(RequestCorrelation.REQUEST_START_NANOS_PROPERTY));

        try {
            responseContext.getHeaders().putSingle(RequestCorrelation.REQUEST_ID_HEADER, requestId);

            LOG.infof(
                    "HTTP request completed %s %s -> %d (%d ms)",
                    requestContext.getMethod(),
                    path,
                    responseContext.getStatus(),
                    durationMs);
        } finally {
            MDC.remove(RequestCorrelation.REQUEST_ID_MDC_KEY);
            MDC.remove(RequestCorrelation.REQUEST_METHOD_MDC_KEY);
            MDC.remove(RequestCorrelation.REQUEST_PATH_MDC_KEY);
        }
    }

    static String resolveRequestId(ContainerRequestContext requestContext) {
        String requestId = firstNonBlank(
                requestContext.getHeaderString(RequestCorrelation.REQUEST_ID_HEADER),
                requestContext.getHeaderString(RequestCorrelation.CORRELATION_ID_HEADER));
        return requestId != null ? requestId : UUID.randomUUID().toString();
    }

    static List<String> sanitizedQueryKeys(ContainerRequestContext requestContext) {
        return requestContext.getUriInfo().getQueryParameters().keySet().stream()
                .map(ApiRequestLoggingFilter::sanitizeQueryKey)
                .distinct()
                .sorted()
                .toList();
    }

    static String normalizedPath(URI requestUri) {
        String path = requestUri.getPath();
        if (path == null || path.isBlank()) {
            return "/";
        }
        return path.startsWith("/") ? path : "/" + path;
    }

    static boolean isApiRequest(String path) {
        return path.startsWith("/api");
    }

    private static String sanitizeQueryKey(String queryKey) {
        String normalizedKey = queryKey.toLowerCase(Locale.ROOT);
        if (normalizedKey.contains("token")
                || normalizedKey.contains("password")
                || normalizedKey.contains("secret")
                || normalizedKey.contains("authorization")) {
            return "<redacted>";
        }
        return queryKey;
    }

    private static String headerValueOrDash(ContainerRequestContext requestContext, String headerName) {
        return firstNonBlank(requestContext.getHeaderString(headerName), "-");
    }

    private static String stringProperty(ContainerRequestContext requestContext, String propertyName) {
        Object value = requestContext.getProperty(propertyName);
        return value == null ? null : value.toString();
    }

    private static long durationMs(Object startNanosValue) {
        if (!(startNanosValue instanceof Long startNanos)) {
            return -1L;
        }
        return (System.nanoTime() - startNanos) / 1_000_000L;
    }

    private static String firstNonBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
    }
}

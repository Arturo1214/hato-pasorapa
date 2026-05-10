package bo.pasorapa.hato.web.rest.observability;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.MultivaluedHashMap;
import jakarta.ws.rs.core.MultivaluedMap;
import jakarta.ws.rs.core.UriInfo;
import java.lang.reflect.Proxy;
import java.net.URI;
import org.junit.jupiter.api.Test;

class ApiRequestLoggingFilterTest {

    @Test
    void shouldReuseIncomingRequestIdHeader() {
        ContainerRequestContext requestContext = requestContext(
                URI.create("http://localhost:8080/api/users?page=1&size=20"),
                headerMap(RequestCorrelation.REQUEST_ID_HEADER, "client-request-123"));

        assertEquals("client-request-123", ApiRequestLoggingFilter.resolveRequestId(requestContext));
    }

    @Test
    void shouldGenerateRequestIdWhenClientDidNotProvideOne() {
        ContainerRequestContext requestContext = requestContext(
                URI.create("http://localhost:8080/api/users"),
                new MultivaluedHashMap<>());

        String generatedRequestId = ApiRequestLoggingFilter.resolveRequestId(requestContext);

        assertFalse(generatedRequestId.isBlank());
    }

    @Test
    void shouldOnlyKeepQueryParameterNamesInSummary() {
        ContainerRequestContext requestContext = requestContext(
                URI.create("http://localhost:8080/api/users?token=secret&page=1&search=juan"),
                new MultivaluedHashMap<>());

        assertEquals(
                java.util.List.of("<redacted>", "page", "search"),
                ApiRequestLoggingFilter.sanitizedQueryKeys(requestContext));
    }

    @Test
    void shouldTreatOnlyApiPathsAsObservableRequests() {
        assertTrue(ApiRequestLoggingFilter.isApiRequest("/api/users"));
        assertFalse(ApiRequestLoggingFilter.isApiRequest("/q/health/ready"));
    }

    private static ContainerRequestContext requestContext(URI requestUri, MultivaluedMap<String, String> headers) {
        UriInfo uriInfo = (UriInfo) Proxy.newProxyInstance(
                UriInfo.class.getClassLoader(),
                new Class<?>[] {UriInfo.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "getRequestUri" -> requestUri;
                    case "getQueryParameters" -> {
                        MultivaluedMap<String, String> queryParameters = new MultivaluedHashMap<>();
                        if (requestUri.getQuery() != null) {
                            for (String entry : requestUri.getQuery().split("&")) {
                                String key = entry.contains("=") ? entry.substring(0, entry.indexOf('=')) : entry;
                                queryParameters.add(key, "masked");
                            }
                        }
                        yield queryParameters;
                    }
                    default -> throw new UnsupportedOperationException(method.getName());
                });

        return (ContainerRequestContext) Proxy.newProxyInstance(
                ContainerRequestContext.class.getClassLoader(),
                new Class<?>[] {ContainerRequestContext.class},
                (proxy, method, args) -> switch (method.getName()) {
                    case "getHeaderString" -> headers.getFirst((String) args[0]);
                    case "getUriInfo" -> uriInfo;
                    default -> throw new UnsupportedOperationException(method.getName());
                });
    }

    private static MultivaluedMap<String, String> headerMap(String headerName, String headerValue) {
        MultivaluedMap<String, String> headers = new MultivaluedHashMap<>();
        headers.add(headerName, headerValue);
        return headers;
    }
}

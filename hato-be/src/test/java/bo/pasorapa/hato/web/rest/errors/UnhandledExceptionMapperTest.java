package bo.pasorapa.hato.web.rest.errors;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import bo.pasorapa.hato.service.error.ErrorResponse;
import bo.pasorapa.hato.web.rest.observability.RequestCorrelation;
import jakarta.ws.rs.core.Response;
import org.jboss.logmanager.MDC;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class UnhandledExceptionMapperTest {

    private final UnhandledExceptionMapper mapper = new UnhandledExceptionMapper();

    @AfterEach
    void tearDown() {
        MDC.clear();
    }

    @Test
    void shouldReturnSafePayloadAndCorrelationHeaders() {
        MDC.put(RequestCorrelation.REQUEST_ID_MDC_KEY, "request-123");
        MDC.put(RequestCorrelation.REQUEST_METHOD_MDC_KEY, "POST");
        MDC.put(RequestCorrelation.REQUEST_PATH_MDC_KEY, "/api/public/test/observability/boom");

        Response response = mapper.toResponse(new IllegalStateException("boom"));

        assertEquals(500, response.getStatus());
        assertEquals("request-123", response.getHeaderString(RequestCorrelation.REQUEST_ID_HEADER));
        assertNotNull(response.getHeaderString(RequestCorrelation.ERROR_ID_HEADER));
        assertTrue(response.getEntity() instanceof ErrorResponse);

        ErrorResponse payload = (ErrorResponse) response.getEntity();
        assertEquals("INTERNAL_SERVER_ERROR", payload.code());
        assertTrue(payload.message().contains("Referencia:"));
        assertFalse(payload.message().contains("boom"));
    }
}

package bo.pasorapa.hato.web.rest.errors;

import bo.pasorapa.hato.service.error.ErrorResponse;
import bo.pasorapa.hato.web.rest.observability.RequestCorrelation;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;
import java.util.UUID;
import org.jboss.logging.Logger;

@Provider
public class UnhandledExceptionMapper implements ExceptionMapper<Throwable> {

    private static final Logger LOG = Logger.getLogger(UnhandledExceptionMapper.class);

    @Override
    public Response toResponse(Throwable exception) {
        if (exception instanceof WebApplicationException webApplicationException) {
            int status = webApplicationException.getResponse().getStatus();
            if (status < 500) {
                return webApplicationException.getResponse();
            }
        }

        String errorId = UUID.randomUUID().toString();
        String requestId = RequestCorrelation.currentRequestId();
        Throwable rootCause = rootCauseOf(exception);

        LOG.errorf(exception,
                "Unhandled server exception [errorId=%s, requestId=%s, method=%s, path=%s, rootType=%s, rootMessage=%s]",
                errorId,
                requestId,
                RequestCorrelation.currentMethod(),
                RequestCorrelation.currentPath(),
                rootCause.getClass().getName(),
                rootCause.getMessage());

        Response.ResponseBuilder responseBuilder = Response.status(Response.Status.INTERNAL_SERVER_ERROR)
                .type(MediaType.APPLICATION_JSON)
                .entity(new ErrorResponse("INTERNAL_SERVER_ERROR", "No pudimos completar la operación. Referencia: " + errorId))
                .header(RequestCorrelation.ERROR_ID_HEADER, errorId);

        if (requestId != null && !requestId.isBlank()) {
            responseBuilder.header(RequestCorrelation.REQUEST_ID_HEADER, requestId);
        }

        return responseBuilder.build();
    }

    private Throwable rootCauseOf(Throwable exception) {
        Throwable current = exception;
        while (current.getCause() != null && current.getCause() != current) {
            current = current.getCause();
        }
        return current;
    }
}

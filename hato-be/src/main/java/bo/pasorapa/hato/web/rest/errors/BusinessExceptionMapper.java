package bo.pasorapa.hato.web.rest.errors;

import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.service.error.ErrorResponse;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.ExceptionMapper;
import jakarta.ws.rs.ext.Provider;

@Provider
public class BusinessExceptionMapper implements ExceptionMapper<BusinessException> {

    @Override
    public Response toResponse(BusinessException exception) {
        return Response.status(exception.status())
                .type(MediaType.APPLICATION_JSON)
                .entity(new ErrorResponse(exception.code(), exception.getMessage()))
                .build();
    }
}

package bo.pasorapa.hato.web.rest.publicapi;

import bo.pasorapa.hato.service.dto.publicapi.ganadero.GanaderoPublicCreateRequest;
import bo.pasorapa.hato.service.dto.publicapi.ganadero.GanaderoPublicResponse;
import bo.pasorapa.hato.service.registration.PublicGanaderoService;
import jakarta.annotation.security.PermitAll;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.HeaderParam;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;

@Path("/api/public/ganaderos")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@PermitAll
public class PublicGanaderosResource {

    private final PublicGanaderoService publicGanaderoService;

    public PublicGanaderosResource(PublicGanaderoService publicGanaderoService) {
        this.publicGanaderoService = publicGanaderoService;
    }

    @POST
    public Response create(
            @Valid GanaderoPublicCreateRequest request,
            @HeaderParam("X-Forwarded-For") String forwardedFor,
            @HeaderParam("X-Real-IP") String realIp) {
        GanaderoPublicResponse response = publicGanaderoService.register(request, resolveIp(forwardedFor, realIp));
        return Response.status(Response.Status.CREATED).entity(response).build();
    }

    private String resolveIp(String forwardedFor, String realIp) {
        if (forwardedFor != null && !forwardedFor.isBlank()) {
            return forwardedFor.split(",")[0].trim();
        }

        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }

        return "unknown";
    }
}

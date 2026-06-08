package bo.pasorapa.hato.web.rest;

import bo.pasorapa.hato.service.AnimalImageService;
import bo.pasorapa.hato.service.dto.animalimage.AnimalImageListResponse;
import jakarta.annotation.security.RolesAllowed;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.UUID;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/api/animals/{uuid}/images")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed({"ADMIN", "GANADERO"})
public class AnimalImageResource {

    private final AnimalImageService animalImageService;
    private final JsonWebToken jsonWebToken;

    public AnimalImageResource(AnimalImageService animalImageService, JsonWebToken jsonWebToken) {
        this.animalImageService = animalImageService;
        this.jsonWebToken = jsonWebToken;
    }

    @GET
    public AnimalImageListResponse list(@PathParam("uuid") UUID animalUuid) {
        return new AnimalImageListResponse(animalImageService.list(animalUuid, currentUserId()));
    }

    private UUID currentUserId() {
        return UUID.fromString(jsonWebToken.getSubject());
    }
}

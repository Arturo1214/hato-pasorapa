package bo.pasorapa.hato.web.rest;

import bo.pasorapa.hato.service.AnimalImageService;
import bo.pasorapa.hato.service.dto.animalimage.AnimalImageContentResponse;
import jakarta.annotation.security.RolesAllowed;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.UUID;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/api/animal-images/{id}/content")
@Consumes(MediaType.APPLICATION_JSON)
@Produces({"image/jpeg", "image/png", MediaType.APPLICATION_OCTET_STREAM})
@RolesAllowed({"ADMIN", "GANADERO"})
public class AnimalImageContentResource {

    private final AnimalImageService animalImageService;
    private final JsonWebToken jsonWebToken;

    public AnimalImageContentResource(AnimalImageService animalImageService, JsonWebToken jsonWebToken) {
        this.animalImageService = animalImageService;
        this.jsonWebToken = jsonWebToken;
    }

    @GET
    public Response download(@PathParam("id") UUID imageId) {
        AnimalImageContentResponse response = animalImageService.download(imageId, currentUserId());
        return Response.ok(response.content(), response.mimeType())
                .header("Content-Disposition", "inline; filename=\"" + response.fileName() + "\"")
                .build();
    }

    private UUID currentUserId() {
        return UUID.fromString(jsonWebToken.getSubject());
    }
}

package bo.pasorapa.hato.web.rest;

import bo.pasorapa.hato.service.AnimalHealthEventService;
import bo.pasorapa.hato.service.dto.vetvisit.VetVisitFilterDto;
import bo.pasorapa.hato.service.dto.vetvisit.VetVisitListResponse;
import jakarta.annotation.security.RolesAllowed;
import jakarta.validation.Valid;
import jakarta.ws.rs.BeanParam;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import java.util.UUID;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/api/vet-visits")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed({"ADMIN", "GANADERO"})
public class VetVisitResource {

    private final AnimalHealthEventService animalHealthEventService;
    private final JsonWebToken jsonWebToken;

    public VetVisitResource(AnimalHealthEventService animalHealthEventService, JsonWebToken jsonWebToken) {
        this.animalHealthEventService = animalHealthEventService;
        this.jsonWebToken = jsonWebToken;
    }

    @GET
    public VetVisitListResponse list(@Valid @BeanParam VetVisitFilterDto filter) {
        return animalHealthEventService.listVetVisits(filter, currentUserId(), jsonWebToken.getGroups().contains("GANADERO"));
    }

    private UUID currentUserId() {
        return UUID.fromString(jsonWebToken.getSubject());
    }
}

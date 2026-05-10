package bo.pasorapa.hato.web.rest;

import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.service.AnimalQueryService;
import bo.pasorapa.hato.service.AnimalService;
import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.service.dto.AnimalCriteria;
import bo.pasorapa.hato.service.dto.AnimalRequest;
import bo.pasorapa.hato.service.dto.birthregistration.BirthRegistrationRequest;
import bo.pasorapa.hato.service.filter.filters.UuidFilter;
import bo.pasorapa.hato.service.mapper.AnimalMapper;
import bo.pasorapa.hato.web.util.AnimalCriteriaDoc;
import bo.pasorapa.hato.web.util.CriteriaBinder;
import bo.pasorapa.hato.web.util.PageRequestDoc;
import bo.pasorapa.hato.web.util.PaginationBinder;
import bo.pasorapa.hato.web.util.ResponseUtil;
import jakarta.annotation.security.RolesAllowed;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.DELETE;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.QueryParam;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.util.UUID;
import org.eclipse.microprofile.openapi.annotations.Operation;
import org.eclipse.microprofile.jwt.JsonWebToken;

@Path("/api/animals")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@RolesAllowed({"ADMIN", "GANADERO"})
public class AnimalResource {

    private final AnimalService animalService;
    private final AnimalQueryService animalQueryService;
    private final AnimalMapper animalMapper;
    private final JsonWebToken jsonWebToken;

    public AnimalResource(AnimalService animalService, AnimalQueryService animalQueryService, AnimalMapper animalMapper, JsonWebToken jsonWebToken) {
        this.animalService = animalService;
        this.animalQueryService = animalQueryService;
        this.animalMapper = animalMapper;
        this.jsonWebToken = jsonWebToken;
    }

    @POST
    @RolesAllowed({"ADMIN", "GANADERO"})
    public Response create(@Valid AnimalRequest request, @Context UriInfo uriInfo) {
        var result = animalMapper.toResponse(animalService.create(request, currentUserId()));
        return Response.created(uriInfo.getAbsolutePathBuilder().path(String.valueOf(result.uuid())).build())
                .entity(result)
                .build();
    }

    @POST
    @Path("/{motherUuid}/birth-registration")
    @RolesAllowed({"ADMIN", "GANADERO"})
    public Response registerBirth(
            @PathParam("motherUuid") UUID motherUuid,
            @Valid BirthRegistrationRequest request,
            @Context UriInfo uriInfo) {
        var result = animalService.registerBirth(motherUuid, request, currentUserId());
        return Response.created(uriInfo.getAbsolutePathBuilder().path(String.valueOf(result.eventId())).build())
                .entity(result)
                .build();
    }

    @PUT
    @Path("/{uuid}")
    @RolesAllowed({"ADMIN", "GANADERO"})
    public Response update(@PathParam("uuid") UUID uuid, @Valid AnimalRequest request) {
        return Response.ok(animalMapper.toResponse(animalService.update(uuid, request, currentUserId()))).build();
    }

    @DELETE
    @Path("/{uuid}")
    @RolesAllowed("ADMIN")
    public Response delete(@PathParam("uuid") UUID uuid) {
        animalService.delete(uuid);
        return Response.noContent().build();
    }

    @GET
    @Operation(
            summary = "Listar animales con filtros y paginación",
            description = """
                    Filtros estilo field.operator.
                    Ejemplos:
                    - ?id.greaterThan=10
                    - ?visible.contains=AR-100
                    - ?category.equals=VACA&active.equals=true
                    - ?admissionDate.greaterThanOrEqual=2024-01-01
                    Paginación:
                    - ?page=0&size=20&sort=updatedAt,desc
                    """
    )
    public Response getAll(
            @jakarta.ws.rs.BeanParam AnimalCriteriaDoc criteriaDoc,
            @jakarta.ws.rs.BeanParam PageRequestDoc pageDoc,
            @Context UriInfo uriInfo
    ) {
        AnimalCriteria criteria = bindCriteria(uriInfo);
        enforceGanaderoOwnerScope(criteria);
        var pageable = PaginationBinder.bind(uriInfo);

        var page = animalQueryService.findByCriteriaPaged(criteria, pageable);
        animalService.applyAutoTransitionsOnRead(page.getContent());
        return Response.ok(page.map(animalMapper::toResponse)).build();
    }

    @GET
    @Path("/count")
    public Response count(@Context UriInfo uriInfo) {
        AnimalCriteria criteria = bindCriteria(uriInfo);
        enforceGanaderoOwnerScope(criteria);
        return Response.ok(animalQueryService.countByCriteria(criteria)).build();
    }

    @GET
    @Path("/{uuid}")
    public Response getOne(@PathParam("uuid") UUID uuid) {
        return Response.ok(animalMapper.toResponse(animalService.findByUuid(uuid, currentUserId()))).build();
    }

    @GET
    @Path("/{uuid}/genealogy")
    public Response getGenealogy(@PathParam("uuid") UUID uuid, @QueryParam("generations") Integer generations) {
        return Response.ok(animalService.findGenealogy(uuid, currentUserId(), generations)).build();
    }

    private AnimalCriteria bindCriteria(UriInfo uriInfo) {
        var hints = new CriteriaBinder.BinderHints()
                .registerEnum("category", AnimalCategory.class);
        try {
            return CriteriaBinder.bind(uriInfo, AnimalCriteria.class, hints);
        } catch (IllegalArgumentException exception) {
            throw new BusinessException("ANIMAL_INVALID_FILTER", exception.getMessage(), Response.Status.BAD_REQUEST);
        }
    }

    private UUID currentUserId() {
        return UUID.fromString(jsonWebToken.getSubject());
    }

    private void enforceGanaderoOwnerScope(AnimalCriteria criteria) {
        if (!jsonWebToken.getGroups().contains("GANADERO")) {
            return;
        }

        UuidFilter ownerFilter = new UuidFilter();
        ownerFilter.setEquals(animalService.resolveAuthenticatedGanaderoId(currentUserId()));
        criteria.setOwnerGanaderoId(ownerFilter);
    }
}

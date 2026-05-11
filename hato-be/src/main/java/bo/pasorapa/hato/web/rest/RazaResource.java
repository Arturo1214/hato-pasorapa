package bo.pasorapa.hato.web.rest;

import bo.pasorapa.hato.service.RazaService;
import bo.pasorapa.hato.service.dto.raza.CreateRazaRequest;
import bo.pasorapa.hato.service.dto.raza.RazaActiveRequest;
import bo.pasorapa.hato.service.dto.raza.RazaListResponse;
import bo.pasorapa.hato.service.dto.raza.UpdateRazaRequest;
import jakarta.annotation.security.RolesAllowed;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.PATCH;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.PUT;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.PathParam;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.Context;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.core.UriInfo;
import java.util.UUID;

@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
@Path("/")
public class RazaResource {

    private final RazaService razaService;

    public RazaResource(RazaService razaService) {
        this.razaService = razaService;
    }

    @GET
    @Path("/api/razas/active")
    @RolesAllowed({"ADMIN", "GANADERO"})
    public Response listActive() {
        return Response.ok(new RazaListResponse<>(razaService.listActiveOptions())).build();
    }

    @GET
    @Path("/api/admin/razas")
    @RolesAllowed("ADMIN")
    public Response listAll() {
        return Response.ok(new RazaListResponse<>(razaService.listAll())).build();
    }

    @GET
    @Path("/api/admin/razas/{uuid}")
    @RolesAllowed("ADMIN")
    public Response getOne(@PathParam("uuid") UUID uuid) {
        return Response.ok(razaService.findByUuid(uuid)).build();
    }

    @POST
    @Path("/api/admin/razas")
    @RolesAllowed("ADMIN")
    public Response create(@Valid CreateRazaRequest request, @Context UriInfo uriInfo) {
        var result = razaService.create(request);
        return Response.created(uriInfo.getAbsolutePathBuilder().path(String.valueOf(result.uuid())).build())
                .entity(result)
                .build();
    }

    @PUT
    @Path("/api/admin/razas/{uuid}")
    @RolesAllowed("ADMIN")
    public Response update(@PathParam("uuid") UUID uuid, @Valid UpdateRazaRequest request) {
        return Response.ok(razaService.update(uuid, request)).build();
    }

    @PATCH
    @Path("/api/admin/razas/{uuid}/active")
    @RolesAllowed("ADMIN")
    public Response setActive(@PathParam("uuid") UUID uuid, @Valid RazaActiveRequest request) {
        return Response.ok(razaService.setActive(uuid, request.activo())).build();
    }
}

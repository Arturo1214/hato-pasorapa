package bo.pasorapa.hato.web.rest;

import bo.pasorapa.hato.service.AuthService;
import bo.pasorapa.hato.service.dto.AuthTokenRequest;
import bo.pasorapa.hato.service.dto.AuthTokenResponse;
import bo.pasorapa.hato.service.dto.admin.auth.AuthLoginRequest;
import bo.pasorapa.hato.service.dto.admin.auth.AuthLoginResponse;
import io.smallrye.jwt.build.Jwt;
import jakarta.annotation.security.RolesAllowed;
import jakarta.validation.Valid;
import jakarta.ws.rs.Consumes;
import jakarta.ws.rs.GET;
import jakarta.ws.rs.NotFoundException;
import jakarta.ws.rs.POST;
import jakarta.ws.rs.Path;
import jakarta.ws.rs.Produces;
import jakarta.ws.rs.core.MediaType;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.jwt.JsonWebToken;
import java.time.Duration;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

@Path("/api/auth")
@Consumes(MediaType.APPLICATION_JSON)
@Produces(MediaType.APPLICATION_JSON)
public class AuthResource {

    private static final long EXPIRES_IN_SECONDS = Duration.ofHours(8).toSeconds();

    private final JsonWebToken jsonWebToken;
    private final AuthService authService;

    @ConfigProperty(name = "auth.legacy-token-enabled", defaultValue = "false")
    boolean legacyTokenEnabled;

    public AuthResource(JsonWebToken jsonWebToken, AuthService authService) {
        this.jsonWebToken = jsonWebToken;
        this.authService = authService;
    }

    @POST
    @Path("/login")
    public AuthLoginResponse login(@Valid AuthLoginRequest request) {
        return authService.login(request);
    }

    @POST
    @Path("/token")
    public AuthTokenResponse token(@Valid AuthTokenRequest request) {
        if (!legacyTokenEnabled) {
            throw new NotFoundException();
        }

        Set<String> roles = request.roles() == null || request.roles().isEmpty()
                ? Set.of("GANADERO")
                : new LinkedHashSet<>(request.roles());

        String token = Jwt.issuer("bo.pasorapa.hato")
                .upn(request.username())
                .preferredUserName(request.username())
                .groups(roles)
                .claim("tenant", "hato")
                .expiresIn(Duration.ofSeconds(EXPIRES_IN_SECONDS))
                .sign();

        return new AuthTokenResponse(token, "Bearer", EXPIRES_IN_SECONDS);
    }

    @GET
    @Path("/me")
    @RolesAllowed({"ADMIN", "GANADERO"})
    public Map<String, Object> me() {
        return Map.of(
                "subject", jsonWebToken.getSubject(),
                "preferredUsername", jsonWebToken.getClaim("preferred_username"),
                "groups", jsonWebToken.getGroups()
        );
    }
}

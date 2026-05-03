package bo.pasorapa.hato.service.registration;

import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.AuthService;
import bo.pasorapa.hato.service.dto.admin.auth.AuthLoginResponse;
import bo.pasorapa.hato.service.dto.publicapi.ganadero.GanaderoPublicCreateRequest;
import bo.pasorapa.hato.service.dto.publicapi.ganadero.GanaderoPublicResponse;
import bo.pasorapa.hato.service.dto.publicapi.ganadero.PublicUserDto;
import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.service.validator.AntiSpamValidator;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;

@ApplicationScoped
public class PublicGanaderoService {

    private final GanaderoRepository ganaderoRepository;
    private final UserRepository userRepository;
    private final AuthService authService;
    private final AntiSpamValidator antiSpamValidator;

    public PublicGanaderoService(
            GanaderoRepository ganaderoRepository,
            UserRepository userRepository,
            AuthService authService,
            AntiSpamValidator antiSpamValidator) {
        this.ganaderoRepository = ganaderoRepository;
        this.userRepository = userRepository;
        this.authService = authService;
        this.antiSpamValidator = antiSpamValidator;
    }

    @Transactional
    public GanaderoPublicResponse register(GanaderoPublicCreateRequest request, String ipAddress) {
        antiSpamValidator.validate(request.website(), request.formIssuedAt(), ipAddress, request.email());

        String normalizedEmail = request.email().trim().toLowerCase();
        String normalizedBusinessIdentifier = request.businessIdentifier().trim();

        if (userRepository.existsByEmailIgnoreCase(normalizedEmail) || ganaderoRepository.findByEmail(normalizedEmail).isPresent()) {
            throw new BusinessException("EMAIL_ALREADY_EXISTS", "El correo ya existe.", Response.Status.CONFLICT);
        }

        if (ganaderoRepository.findByBusinessIdentifier(normalizedBusinessIdentifier).isPresent()) {
            throw new BusinessException("GANADERO_ALREADY_EXISTS", "Ya existe un ganadero con ese identificador.", Response.Status.CONFLICT);
        }

        Ganadero ganadero = new Ganadero();
        ganadero.setBusinessIdentifier(normalizedBusinessIdentifier);
        ganadero.setName(request.name().trim());
        ganadero.setEmail(normalizedEmail);
        ganadero.setActive(true);
        ganaderoRepository.persist(ganadero);

        User user = new User();
        user.setUsername(normalizedEmail);
        user.setEmail(normalizedEmail);
        user.setDisplayName(request.name().trim());
        user.setRole(Role.GANADERO);
        user.setStatus(UserStatus.ACTIVE);
        user.setPasswordHash(authService.hashPassword(request.password()));
        userRepository.persist(user);
        userRepository.flush();
        ganaderoRepository.flush();

        AuthLoginResponse authResponse = authService.issueToken(user);
        return new GanaderoPublicResponse(
                authResponse.accessToken(),
                authResponse.tokenType(),
                authResponse.expiresInSeconds(),
                new PublicUserDto(
                        authResponse.user().id(),
                        authResponse.user().username(),
                        authResponse.user().email(),
                        authResponse.user().displayName(),
                        authResponse.user().role(),
                        authResponse.user().status()));
    }
}

package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.dto.admin.auth.AuthLoginRequest;
import bo.pasorapa.hato.service.dto.admin.auth.AuthLoginResponse;
import bo.pasorapa.hato.service.dto.admin.auth.AuthUserResponse;
import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.service.security.PasswordHasher;
import bo.pasorapa.hato.web.rest.observability.RequestCorrelation;
import io.smallrye.jwt.build.Jwt;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import org.jboss.logging.Logger;

@ApplicationScoped
public class AuthService {

    private static final Logger LOG = Logger.getLogger(AuthService.class);
    private static final long EXPIRES_IN_SECONDS = Duration.ofHours(8).toSeconds();
    public static final String PASSWORD_POLICY_REGEX = "^(?=.*[A-Z])(?=.*\\d).{8,}$";
    public static final String PASSWORD_POLICY_MESSAGE = "La contraseña debe tener al menos 8 caracteres, 1 mayúscula y 1 número.";
    private static final Pattern PASSWORD_POLICY_PATTERN = Pattern.compile(PASSWORD_POLICY_REGEX);

    private final UserRepository userRepository;
    private final GanaderoRepository ganaderoRepository;
    private final PasswordHasher passwordHasher;

    public AuthService(UserRepository userRepository, GanaderoRepository ganaderoRepository, PasswordHasher passwordHasher) {
        this.userRepository = userRepository;
        this.ganaderoRepository = ganaderoRepository;
        this.passwordHasher = passwordHasher;
    }

    public AuthLoginResponse login(AuthLoginRequest request) {
        String identifier = normalizeIdentifier(request.username());
        User user = resolveUser(identifier)
                .orElseThrow(() -> invalidLogin(identifier, "USER_NOT_FOUND", "INVALID_CREDENTIALS", "Las credenciales son inválidas."));

        if (!passwordHasher.matches(request.password(), user.getPasswordHash())) {
            throw invalidLogin(identifier, "BAD_PASSWORD", "INVALID_CREDENTIALS", "Las credenciales son inválidas.");
        }

        if (user.getStatus() == UserStatus.INACTIVE) {
            throw invalidLogin(
                    identifier,
                    "INACTIVE_USER",
                    "ACCOUNT_INACTIVE",
                    "La cuenta está inactiva. Contactá a un administrador.");
        }

        if (user.getStatus() == UserStatus.BLOCKED) {
            throw invalidLogin(
                    identifier,
                    "BLOCKED_USER",
                    "ACCOUNT_BLOCKED",
                    "La cuenta está bloqueada. Contactá a un administrador.");
        }

        return issueToken(user);
    }

    private java.util.Optional<User> resolveUser(String identifier) {
        java.util.Optional<User> directMatch = userRepository.findByUsernameOrEmail(identifier);
        if (directMatch.isPresent()) {
            return directMatch;
        }

        return ganaderoRepository.findByBusinessIdentifier(identifier)
                .map(Ganadero::getEmail)
                .filter(email -> email != null && !email.isBlank())
                .flatMap(userRepository::findByUsernameOrEmail);
    }

    private BusinessException invalidLogin(String identifier, String reasonCategory, String code, String message) {
        String requestId = RequestCorrelation.currentRequestId();
        LOG.warnf(
                "Authentication failed [requestId=%s, identifierType=%s, identifier=%s, reasonCategory=%s]",
                requestId,
                inferIdentifierType(identifier),
                maskIdentifier(identifier),
                reasonCategory);
        return new BusinessException(code, message, Response.Status.UNAUTHORIZED);
    }

    private String normalizeIdentifier(String identifier) {
        return identifier == null ? "" : identifier.trim();
    }

    private String inferIdentifierType(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return "EMPTY";
        }
        if (identifier.contains("@")) {
            return "EMAIL";
        }
        if (identifier.chars().allMatch(Character::isDigit)) {
            return "BUSINESS_IDENTIFIER";
        }
        return "USERNAME";
    }

    private String maskIdentifier(String identifier) {
        if (identifier == null || identifier.isBlank()) {
            return "<empty>";
        }

        if (identifier.contains("@")) {
            String[] parts = identifier.split("@", 2);
            return maskToken(parts[0]) + "@" + parts[1].toLowerCase(Locale.ROOT);
        }

        return maskToken(identifier);
    }

    private String maskToken(String value) {
        if (value.length() <= 2) {
            return "**";
        }
        if (value.length() <= 4) {
            return value.charAt(0) + "**" + value.charAt(value.length() - 1);
        }
        return value.substring(0, 2) + "***" + value.substring(value.length() - 2);
    }

    public void ensurePasswordPolicy(String password) {
        if (password == null || !PASSWORD_POLICY_PATTERN.matcher(password).matches()) {
            throw new BusinessException(
                    "PASSWORD_POLICY_VIOLATION",
                    PASSWORD_POLICY_MESSAGE,
                    Response.Status.BAD_REQUEST);
        }
    }

    public String hashPassword(String password) {
        ensurePasswordPolicy(password);
        return passwordHasher.hash(password);
    }

    public AuthLoginResponse issueToken(User user) {
        String token = Jwt.issuer("bo.pasorapa.hato")
                .subject(user.getId().toString())
                .upn(user.getUsername())
                .preferredUserName(user.getUsername())
                .groups(Set.of(user.getRole().name()))
                .claim("role", user.getRole().name())
                .claim("userVersion", user.getVersion() == null ? 0L : user.getVersion())
                .claim("status", user.getStatus().name())
                .claim("tenant", "hato")
                .expiresIn(Duration.ofSeconds(EXPIRES_IN_SECONDS))
                .sign();

        return new AuthLoginResponse(
                token,
                "Bearer",
                EXPIRES_IN_SECONDS,
                new AuthUserResponse(
                        user.getId().toString(),
                        user.getUsername(),
                        user.getEmail(),
                        user.getDisplayName(),
                        user.getRole().name(),
                        user.getStatus().name(),
                        user.getVersion() == null ? 0L : user.getVersion(),
                        user.getUpdatedAt() == null ? null : user.getUpdatedAt().toString(),
                        user.getLastSyncedAt() == null ? null : user.getLastSyncedAt().toString()));
    }
}

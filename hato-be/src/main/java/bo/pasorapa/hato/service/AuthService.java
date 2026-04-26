package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.dto.admin.auth.AuthLoginRequest;
import bo.pasorapa.hato.service.dto.admin.auth.AuthLoginResponse;
import bo.pasorapa.hato.service.dto.admin.auth.AuthUserResponse;
import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.service.security.PasswordHasher;
import io.smallrye.jwt.build.Jwt;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.util.Set;
import java.util.regex.Pattern;

@ApplicationScoped
public class AuthService {

    private static final long EXPIRES_IN_SECONDS = Duration.ofHours(8).toSeconds();
    public static final String PASSWORD_POLICY_REGEX = "^(?=.*[A-Z])(?=.*\\d).{8,}$";
    public static final String PASSWORD_POLICY_MESSAGE = "La contraseña debe tener al menos 8 caracteres, 1 mayúscula y 1 número.";
    private static final Pattern PASSWORD_POLICY_PATTERN = Pattern.compile(PASSWORD_POLICY_REGEX);

    private final UserRepository userRepository;
    private final PasswordHasher passwordHasher;

    public AuthService(UserRepository userRepository, PasswordHasher passwordHasher) {
        this.userRepository = userRepository;
        this.passwordHasher = passwordHasher;
    }

    public AuthLoginResponse login(AuthLoginRequest request) {
        User user = userRepository.findByUsernameOrEmail(request.username())
                .orElseThrow(() -> new BusinessException(
                        "INVALID_CREDENTIALS",
                        "Las credenciales son inválidas.",
                        Response.Status.UNAUTHORIZED));

        if (!passwordHasher.matches(request.password(), user.getPasswordHash())) {
            throw new BusinessException(
                    "INVALID_CREDENTIALS",
                    "Las credenciales son inválidas.",
                    Response.Status.UNAUTHORIZED);
        }

        if (user.getStatus() == UserStatus.INACTIVE) {
            throw new BusinessException(
                    "ACCOUNT_INACTIVE",
                    "La cuenta está inactiva. Contactá a un administrador.",
                    Response.Status.FORBIDDEN);
        }

        if (user.getStatus() == UserStatus.BLOCKED) {
            throw new BusinessException(
                    "ACCOUNT_BLOCKED",
                    "La cuenta está bloqueada. Contactá a un administrador.",
                    Response.Status.FORBIDDEN);
        }

        return issueToken(user);
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

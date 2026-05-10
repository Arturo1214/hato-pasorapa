package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import bo.pasorapa.hato.service.dto.admin.auth.AuthLoginRequest;
import bo.pasorapa.hato.service.dto.admin.auth.AuthLoginResponse;
import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.service.security.PasswordHasher;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.util.UUID;
import jakarta.ws.rs.core.Response;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AuthServiceTest {

    @Inject
    AuthService authService;

    @Inject
    UserRepository userRepository;

    @Inject
    GanaderoRepository ganaderoRepository;

    @Inject
    PasswordHasher passwordHasher;

    @Inject
    IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            integrationDatabaseCleaner.clean();
            userRepository.persist(buildUser("admin", Role.ADMIN, UserStatus.ACTIVE, "Admin123"));
            userRepository.persist(buildUser("inactive", Role.GANADERO, UserStatus.INACTIVE, "Ganadero9"));
            userRepository.persist(buildUser("blocked", Role.ADMIN, UserStatus.BLOCKED, "Blocked99"));
            userRepository.persist(buildUser("ganadero@hato.bo", Role.GANADERO, UserStatus.ACTIVE, "Ganadero9"));

            Ganadero ganadero = new Ganadero();
            ganadero.setBusinessIdentifier("12345678");
            ganadero.setName("Ganadero CI");
            ganadero.setEmail("ganadero@hato.bo");
            ganaderoRepository.persist(ganadero);
        });
    }

    @Test
    void shouldRejectPasswordThatBreaksPolicy() {
        BusinessException exception = assertThrows(BusinessException.class,
                () -> authService.ensurePasswordPolicy("weakpass"));

        assertEquals("PASSWORD_POLICY_VIOLATION", exception.code());
    }

    @Test
    void shouldRejectInactiveAccounts() {
        BusinessException exception = assertThrows(BusinessException.class,
                () -> authService.login(new AuthLoginRequest("inactive", "Ganadero9")));

        assertEquals("ACCOUNT_INACTIVE", exception.code());
        assertEquals(Response.Status.UNAUTHORIZED, exception.status());
    }

    @Test
    void shouldRejectBlockedAccounts() {
        BusinessException exception = assertThrows(BusinessException.class,
                () -> authService.login(new AuthLoginRequest("blocked", "Blocked99")));

        assertEquals("ACCOUNT_BLOCKED", exception.code());
        assertEquals(Response.Status.UNAUTHORIZED, exception.status());
    }

    @Test
    void shouldRejectInvalidCredentials() {
        BusinessException exception = assertThrows(BusinessException.class,
                () -> authService.login(new AuthLoginRequest("admin", "wrong")));

        assertEquals("INVALID_CREDENTIALS", exception.code());
    }

    @Test
    void shouldAuthenticateGanaderoWithEmail() {
        AuthLoginResponse response = authService.login(new AuthLoginRequest("ganadero@hato.bo", "Ganadero9"));

        assertEquals("ganadero@hato.bo", response.user().username());
    }

    @Test
    void shouldAuthenticateGanaderoWithBusinessIdentifier() {
        AuthLoginResponse response = authService.login(new AuthLoginRequest("12345678", "Ganadero9"));

        assertEquals("ganadero@hato.bo", response.user().username());
    }

    @Test
    void shouldReturnGenericErrorForUnknownIdentifier() {
        BusinessException exception = assertThrows(BusinessException.class,
                () -> authService.login(new AuthLoginRequest("99999999", "Ganadero9")));

        assertEquals("INVALID_CREDENTIALS", exception.code());
    }

    private User buildUser(String username, Role role, UserStatus status, String password) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername(username);
        user.setEmail(username + "@hato.bo");
        user.setDisplayName(username);
        user.setPasswordHash(passwordHasher.hash(password));
        user.setRole(role);
        user.setStatus(status);
        return user;
    }
}

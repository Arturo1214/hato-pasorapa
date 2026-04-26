package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.dto.admin.auth.AuthLoginRequest;
import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.service.security.PasswordHasher;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AuthServiceTest {

    @Inject
    AuthService authService;

    @Inject
    UserRepository userRepository;

    @Inject
    PasswordHasher passwordHasher;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            userRepository.deleteAll();
            userRepository.persist(buildUser("admin", Role.ADMIN, UserStatus.ACTIVE, "Admin123"));
            userRepository.persist(buildUser("inactive", Role.GANADERO, UserStatus.INACTIVE, "Ganadero9"));
            userRepository.persist(buildUser("blocked", Role.ADMIN, UserStatus.BLOCKED, "Blocked99"));
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
    }

    @Test
    void shouldRejectBlockedAccounts() {
        BusinessException exception = assertThrows(BusinessException.class,
                () -> authService.login(new AuthLoginRequest("blocked", "Blocked99")));

        assertEquals("ACCOUNT_BLOCKED", exception.code());
    }

    @Test
    void shouldRejectInvalidCredentials() {
        BusinessException exception = assertThrows(BusinessException.class,
                () -> authService.login(new AuthLoginRequest("admin", "wrong")));

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

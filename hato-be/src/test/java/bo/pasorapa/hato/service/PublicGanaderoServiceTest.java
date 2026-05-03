package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.dto.publicapi.ganadero.GanaderoPublicCreateRequest;
import bo.pasorapa.hato.service.dto.publicapi.ganadero.GanaderoPublicResponse;
import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.service.registration.PublicGanaderoService;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import bo.pasorapa.hato.service.security.PasswordHasher;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class PublicGanaderoServiceTest {

    @Inject
    PublicGanaderoService publicGanaderoService;

    @Inject
    UserRepository userRepository;

    @Inject
    GanaderoRepository ganaderoRepository;

    @Inject
    IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @Inject
    PasswordHasher passwordHasher;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> integrationDatabaseCleaner.clean());
    }

    @Test
    void shouldCreateGanaderoAndUserAtomicallyUsingEmailAsUsername() {
        GanaderoPublicResponse response = publicGanaderoService.register(new GanaderoPublicCreateRequest(
                "12345678",
                "Ganadera Norte",
                "ganadera@hato.bo",
                "Ganadera9",
                "",
                Instant.now().minusSeconds(5)), "127.0.0.1");

        QuarkusTransaction.requiringNew().run(() -> {
            assertEquals(1, ganaderoRepository.count());
            assertEquals(1, userRepository.count());
            User createdUser = userRepository.findByUsernameOrEmail("ganadera@hato.bo").orElseThrow();
            assertEquals(Role.GANADERO, createdUser.getRole());
            assertEquals(UserStatus.ACTIVE, createdUser.getStatus());
        });

        assertEquals("ganadera@hato.bo", response.user().username());
    }

    @Test
    void shouldRejectDuplicateEmail() {
        QuarkusTransaction.requiringNew().run(() -> userRepository.persist(buildUser("ganadera@hato.bo", "ganadera@hato.bo")));

        BusinessException exception = assertThrows(BusinessException.class,
                () -> publicGanaderoService.register(new GanaderoPublicCreateRequest(
                        "12345678",
                        "Ganadera Norte",
                        "ganadera@hato.bo",
                        "Ganadera9",
                        "",
                        Instant.now().minusSeconds(5)), "127.0.0.1"));

        assertEquals("EMAIL_ALREADY_EXISTS", exception.code());
    }

    @Test
    void shouldRejectDuplicateBusinessIdentifierWithoutCreatingUser() {
        QuarkusTransaction.requiringNew().run(() -> {
            Ganadero ganadero = new Ganadero();
            ganadero.setBusinessIdentifier("12345678");
            ganadero.setName("Base");
            ganadero.setEmail("base@hato.bo");
            ganaderoRepository.persist(ganadero);
        });

        BusinessException exception = assertThrows(BusinessException.class,
                () -> publicGanaderoService.register(new GanaderoPublicCreateRequest(
                        "12345678",
                        "Ganadera Norte",
                        "nueva@hato.bo",
                        "Ganadera9",
                        "",
                        Instant.now().minusSeconds(5)), "127.0.0.1"));

        assertEquals("GANADERO_ALREADY_EXISTS", exception.code());
        QuarkusTransaction.requiringNew().run(() -> assertEquals(0, userRepository.count()));
    }

    private User buildUser(String username, String email) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername(username);
        user.setEmail(email);
        user.setDisplayName("Ganadera existente");
        user.setPasswordHash(passwordHasher.hash("Ganadera9"));
        user.setRole(Role.GANADERO);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }
}

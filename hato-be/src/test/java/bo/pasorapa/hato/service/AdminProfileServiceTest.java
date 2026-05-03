package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.dto.admin.profile.ProfileUpdateRequest;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AdminProfileServiceTest {

    private static final UUID USER_ID = UUID.fromString("71717171-7171-4171-8171-717171717171");

    @Inject AdminProfileService adminProfileService;
    @Inject UserRepository userRepository;
    @Inject GanaderoRepository ganaderoRepository;
    @Inject IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            integrationDatabaseCleaner.clean();
            userRepository.persist(buildUser());
            ganaderoRepository.persist(buildGanadero());
        });
    }

    @Test
    void shouldUpdateProfileUsingAuthenticatedUsersEmailLinkedGanadero() {
        ProfileUpdateRequest request = new ProfileUpdateRequest("70000001", "Calle Comercio #15");

        var response = QuarkusTransaction.requiringNew().call(() -> adminProfileService.updateProfile(USER_ID, request));
        Ganadero ganadero = QuarkusTransaction.requiringNew().call(() -> ganaderoRepository.findByEmail("campo@hato.bo").orElseThrow());

        assertEquals("70000001", response.telefono());
        assertEquals("Calle Comercio #15", response.direccion());
        assertEquals("GANADERO", response.role());
        assertEquals(true, ganadero.getContactInfo().contains("70000001"));
        assertEquals(true, ganadero.getContactInfo().contains("Calle Comercio #15"));
    }

    private User buildUser() {
        User user = new User();
        user.setId(USER_ID);
        user.setUsername("campo@hato.bo");
        user.setEmail("campo@hato.bo");
        user.setDisplayName("Campo Base");
        user.setRole(Role.GANADERO);
        user.setStatus(UserStatus.ACTIVE);
        user.setPasswordHash("hash");
        return user;
    }

    private Ganadero buildGanadero() {
        Ganadero ganadero = new Ganadero();
        ganadero.setId(UUID.fromString("72727272-7272-4272-8272-727272727272"));
        ganadero.setBusinessIdentifier("CI-900");
        ganadero.setName("Campo Base");
        ganadero.setEmail("campo@hato.bo");
        ganadero.setActive(true);
        return ganadero;
    }
}

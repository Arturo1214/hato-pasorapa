package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.repository.AnimalEventRepository;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import bo.pasorapa.hato.service.dto.AnimalRequest;
import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.service.security.PasswordHasher;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.Response;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

@QuarkusTest
class AnimalServiceTest {

    private static final UUID PRIMARY_GANADERO_ID = UUID.fromString("95315ab0-0f7c-4b94-a55e-912d179a702c");
    private static final UUID SECONDARY_GANADERO_ID = UUID.fromString("0bc0253e-c4b0-4fc3-94bd-669032bce518");
    private static final UUID GANADERO_USER_ID = UUID.fromString("f5e0d58a-b5f8-4424-833a-22364e13c111");
    private static final UUID ADMIN_USER_ID = UUID.fromString("3b8d8a14-6f29-4f8a-b5a7-c5a69a655555");

    @Inject
    AnimalService animalService;

    @Inject
    AnimalRepository animalRepository;

    @Inject
    AnimalEventRepository animalEventRepository;

    @Inject
    GanaderoRepository ganaderoRepository;

    @Inject
    UserRepository userRepository;

    @Inject
    PasswordHasher passwordHasher;

    @Inject
    IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            integrationDatabaseCleaner.clean();
            ganaderoRepository.persist(buildGanadero(PRIMARY_GANADERO_ID, "NIT-ANIMAL-001", "Ganadero Uno", "ganadero1@hato.bo"));
            ganaderoRepository.persist(buildGanadero(SECONDARY_GANADERO_ID, "NIT-ANIMAL-002", "Ganadero Dos", "ganadero2@hato.bo"));
            userRepository.persist(buildUser(ADMIN_USER_ID, "animal-admin", "animal-admin@hato.bo", Role.ADMIN));
            userRepository.persist(buildUser(GANADERO_USER_ID, "ganadero-uno", "ganadero1@hato.bo", Role.GANADERO));
            animalRepository.persist(buildAnimal(
                    UUID.fromString("0b79206a-ec9c-4ebc-bb90-0992f57f9687"),
                    PRIMARY_GANADERO_ID,
                    " BO-1000 ",
                    "Marca Base",
                    "Tatuaje Base"));
        });
    }

    @Test
    void shouldRejectCreateWhenOwnerGanaderoDoesNotExist() {
        BusinessException exception = assertThrows(BusinessException.class, () -> QuarkusTransaction.requiringNew().call(() ->
                animalService.create(new AnimalRequest(
                        UUID.fromString("11111111-1111-1111-1111-111111111111"),
                        "BO-2000",
                        null,
                        null,
                        AnimalCategory.VACA,
                        AnimalSex.HEMBRA,
                        true,
                        LocalDate.of(2024, 2, 1),
                        new BigDecimal("410.50"),
                        null))));

        assertEquals("ANIMAL_OWNER_NOT_FOUND", exception.code());
    }

    @Test
    void shouldRequireAtLeastOneVisibleIdentifier() {
        BusinessException exception = assertThrows(BusinessException.class, () -> QuarkusTransaction.requiringNew().call(() ->
                animalService.create(new AnimalRequest(
                        PRIMARY_GANADERO_ID,
                        " ",
                        null,
                        null,
                        AnimalCategory.VACA,
                        AnimalSex.HEMBRA,
                        true,
                        LocalDate.of(2024, 2, 1),
                        new BigDecimal("410.50"),
                        null))));

        assertEquals("ANIMAL_VISIBLE_IDENTIFIER_REQUIRED", exception.code());
    }

    @Test
    void shouldRejectNormalizedAreteCollision() {
        BusinessException exception = assertThrows(BusinessException.class, () -> QuarkusTransaction.requiringNew().call(() ->
                animalService.create(new AnimalRequest(
                        SECONDARY_GANADERO_ID,
                        "bo-1000",
                        "Otra Marca",
                        null,
                        AnimalCategory.VACA,
                        AnimalSex.HEMBRA,
                        true,
                        LocalDate.of(2024, 3, 1),
                        new BigDecimal("390.00"),
                        null))));

        assertEquals("ANIMAL_ARETE_ALREADY_EXISTS", exception.code());
    }

    @Test
    void shouldAllowRepeatedMarcaAndTatuajeAcrossDifferentAnimals() {
        assertDoesNotThrow(() -> QuarkusTransaction.requiringNew().call(() ->
                animalService.create(new AnimalRequest(
                        SECONDARY_GANADERO_ID,
                        "BO-3000",
                        "Marca Base",
                        "Tatuaje Base",
                        AnimalCategory.VACA,
                        AnimalSex.HEMBRA,
                        true,
                        LocalDate.of(2024, 3, 1),
                        new BigDecimal("390.00"),
                        null))));
    }

    @ParameterizedTest
    @CsvSource({
            "VACA,MACHO",
            "TERNERO,HEMBRA",
            "TERNERA,MACHO",
            "BUEY,HEMBRA",
            "VAQUILLONA,MACHO"
    })
    void shouldRejectInvalidSexCategoryCombination(AnimalCategory category, AnimalSex sex) {
        BusinessException exception = assertThrows(BusinessException.class, () -> QuarkusTransaction.requiringNew().call(() ->
                animalService.create(new AnimalRequest(
                        PRIMARY_GANADERO_ID,
                        "BO-6000",
                        null,
                        null,
                        category,
                        sex,
                        true,
                        LocalDate.of(2024, 2, 1),
                        new BigDecimal("410.50"),
                        LocalDate.of(2023, 2, 1)))));

        assertEquals("INVALID_SEX_CATEGORY_COMBINATION", exception.code());
    }

    @Test
    void shouldRequireBirthDateForYoungAnimals() {
        BusinessException exception = assertThrows(BusinessException.class, () -> QuarkusTransaction.requiringNew().call(() ->
                animalService.create(new AnimalRequest(
                        PRIMARY_GANADERO_ID,
                        "BO-7000",
                        null,
                        null,
                        AnimalCategory.TERNERO,
                        AnimalSex.MACHO,
                        true,
                        LocalDate.of(2024, 2, 1),
                        new BigDecimal("410.50"),
                        null))));

        assertEquals("BIRTH_DATE_REQUIRED_FOR_YOUNG_ANIMAL", exception.code());
    }

    @Test
    void shouldAutoTransitionYoungMaleAnimalsOnRead() {
        UUID uuid = UUID.fromString("7d8c18f3-ea47-4f20-b1b8-b5f15f803f55");
        QuarkusTransaction.requiringNew().run(() -> {
            Animal animal = buildAnimal(uuid, PRIMARY_GANADERO_ID, "BO-8000", "Marca Joven", null);
            animal.setCategory(AnimalCategory.TERNERO);
            animal.setSex(AnimalSex.MACHO);
            animal.setBirthDate(LocalDate.now().minusMonths(25));
            animalRepository.persist(animal);
        });

        Animal transitioned = QuarkusTransaction.requiringNew().call(() -> animalService.findByUuid(uuid));
        assertEquals(AnimalCategory.TORO, transitioned.getCategory());
    }

    @Test
    void shouldKeepYoungAnimalCategoryWhenTransitionDoesNotApply() {
        UUID uuid = UUID.fromString("d6ea4011-5300-4ebf-8a96-14e88c1291d2");
        QuarkusTransaction.requiringNew().run(() -> {
            Animal animal = buildAnimal(uuid, PRIMARY_GANADERO_ID, "BO-8100", "Marca Joven", null);
            animal.setCategory(AnimalCategory.TERNERO);
            animal.setSex(AnimalSex.MACHO);
            animal.setBirthDate(LocalDate.now().minusMonths(23));
            animalRepository.persist(animal);
        });

        Animal pendingTransition = QuarkusTransaction.requiringNew().call(() -> animalService.findByUuid(uuid));
        assertEquals(AnimalCategory.TERNERO, pendingTransition.getCategory());
    }

    @Test
    void shouldDeriveOwnerFromAuthenticatedGanaderoWhenOwnerIsOmitted() {
        Animal created = QuarkusTransaction.requiringNew().call(() ->
                animalService.create(new AnimalRequest(
                        null,
                        "BO-9000",
                        null,
                        null,
                        AnimalCategory.VACA,
                        AnimalSex.HEMBRA,
                        true,
                        LocalDate.of(2024, 2, 1),
                        new BigDecimal("450.00"),
                        null), GANADERO_USER_ID));

        assertEquals(PRIMARY_GANADERO_ID, created.getOwnerGanadero().getId());
    }

    @Test
    void shouldPreventGanaderoOwnerSpoofing() {
        BusinessException exception = assertThrows(BusinessException.class, () -> QuarkusTransaction.requiringNew().call(() ->
                animalService.create(new AnimalRequest(
                        SECONDARY_GANADERO_ID,
                        "BO-9100",
                        null,
                        null,
                        AnimalCategory.VACA,
                        AnimalSex.HEMBRA,
                        true,
                        LocalDate.of(2024, 2, 1),
                        new BigDecimal("410.50"),
                        null), GANADERO_USER_ID)));

        assertEquals("ANIMAL_OWNER_OVERRIDE_FORBIDDEN", exception.code());
        assertEquals(Response.Status.FORBIDDEN, exception.status());
    }

    @Test
    void shouldStillRequireOwnerForAdminMutations() {
        BusinessException exception = assertThrows(BusinessException.class, () -> QuarkusTransaction.requiringNew().call(() ->
                animalService.create(new AnimalRequest(
                        null,
                        "BO-9200",
                        null,
                        null,
                        AnimalCategory.VACA,
                        AnimalSex.HEMBRA,
                        true,
                        LocalDate.of(2024, 2, 1),
                        new BigDecimal("410.50"),
                        null), ADMIN_USER_ID)));

        assertEquals("ANIMAL_OWNER_GANADERO_ID_REQUIRED", exception.code());
        assertEquals(Response.Status.BAD_REQUEST, exception.status());
    }

    private Ganadero buildGanadero(UUID id, String businessIdentifier, String name, String email) {
        Ganadero ganadero = new Ganadero();
        ganadero.setId(id);
        ganadero.setBusinessIdentifier(businessIdentifier);
        ganadero.setName(name);
        ganadero.setEmail(email);
        ganadero.setActive(true);
        return ganadero;
    }

    private User buildUser(UUID id, String username, String email, Role role) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setEmail(email);
        user.setDisplayName(username);
        user.setPasswordHash(passwordHasher.hash("Password9"));
        user.setRole(role);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }

    private Animal buildAnimal(UUID uuid, UUID ownerGanaderoId, String arete, String marca, String tatuaje) {
        Animal animal = new Animal();
        animal.setUuid(uuid);
        animal.setOwnerGanadero(ganaderoRepository.findByIdOptional(ownerGanaderoId).orElseThrow());
        animal.setArete(arete);
        animal.setMarca(marca);
        animal.setTatuaje(tatuaje);
        animal.setAreteNormalized(arete == null ? null : arete.trim().toLowerCase());
        animal.setMarcaNormalized(marca == null ? null : marca.trim().toLowerCase());
        animal.setTatuajeNormalized(tatuaje == null ? null : tatuaje.trim().toLowerCase());
        animal.setTag(arete);
        animal.setCode(marca);
        animal.setCategory(AnimalCategory.VACA);
        animal.setSex(AnimalSex.HEMBRA);
        animal.setActive(true);
        animal.setAdmissionDate(LocalDate.of(2024, 1, 10));
        animal.setWeightKg(new BigDecimal("420.50"));
        return animal;
    }
}

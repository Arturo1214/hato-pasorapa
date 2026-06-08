package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.service.model.AnimalEvent;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.domain.enumeration.AnimalEventType;
import bo.pasorapa.hato.repository.AnimalEventLogRepository;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import bo.pasorapa.hato.service.mapper.AnimalEventMapper;
import bo.pasorapa.hato.service.security.PasswordHasher;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AnimalEventResourceTest {

    private static final UUID OWNER_ID = UUID.fromString("e469411a-c4cb-4718-b60b-b5c157af5292");
    private static final UUID USER_ID = UUID.fromString("d67037ca-6f3f-4e97-a1a0-e8bc25bb33ea");

    @Inject
    UserRepository userRepository;

    @Inject
    AnimalRepository animalRepository;

    @Inject
    AnimalEventLogRepository animalEventLogRepository;

    @Inject
    AnimalEventMapper mapper;

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
            userRepository.persist(buildUser("animal-event-admin", "animal-event-admin@hato.bo", "AnimalEvent9"));
            ganaderoRepository.persist(buildGanadero(OWNER_ID, "NIT-ANIMAL-001", "Ganadero Animal"));
        });
    }

    @Test
    void shouldListAnimalEventsUsingFiltersAndDeterministicOrdering() {
        UUID animalUuid = UUID.fromString("a08cd51e-bf3b-4629-b679-d0f5ac608773");
        seedAnimal(animalUuid);
        seedEvent(animalUuid, AnimalEventType.OBSERVATION, "2026-04-26T10:00:00", UUID.fromString("00000000-0000-0000-0000-000000000200"));
        seedEvent(animalUuid, AnimalEventType.SOLD, "2026-04-26T09:00:00", UUID.fromString("00000000-0000-0000-0000-000000000100"));
        seedEvent(animalUuid, AnimalEventType.OBSERVATION, "2026-04-26T10:00:00", UUID.fromString("00000000-0000-0000-0000-000000000300"));

        String token = loginAs("animal-event-admin", "AnimalEvent9");

        given()
                .auth().oauth2(token)
                .queryParam("eventType", "OBSERVATION")
                .queryParam("occurredFrom", "2026-04-26T09:30:00Z")
                .queryParam("occurredTo", "2026-04-26T10:30:00Z")
                .when()
                .get("/api/animals/{uuid}/events", animalUuid)
                .then()
                .statusCode(200)
                .body("items", hasSize(2))
                .body("items[0].operationId", equalTo("00000000-0000-0000-0000-000000000200"))
                .body("items[1].operationId", equalTo("00000000-0000-0000-0000-000000000300"))
                .body("items[0].type", equalTo("OBSERVATION"));
    }

    @Test
    void shouldDenyGanaderoListingEventsForAnotherOwnerAnimal() {
        UUID ownOwnerId = UUID.fromString("e469411a-c4cb-4718-b60b-b5c157af5293");
        UUID otherOwnerId = UUID.fromString("e469411a-c4cb-4718-b60b-b5c157af5294");
        UUID otherAnimalUuid = UUID.fromString("a08cd51e-bf3b-4629-b679-d0f5ac608774");
        QuarkusTransaction.requiringNew().run(() -> {
            ganaderoRepository.persist(buildGanadero(ownOwnerId, "NIT-ANIMAL-OWN", "Ganadero Own", "ganadero-event@hato.bo"));
            ganaderoRepository.persist(buildGanadero(otherOwnerId, "NIT-ANIMAL-OTHER", "Ganadero Other", "other-event@hato.bo"));
            userRepository.persist(buildUser("ganadero-event", "ganadero-event@hato.bo", "AnimalEvent9", Role.GANADERO));
        });
        seedAnimal(otherAnimalUuid, otherOwnerId);
        seedEvent(otherAnimalUuid, AnimalEventType.OBSERVATION, "2026-04-26T10:00:00", UUID.fromString("00000000-0000-0000-0000-000000000210"));

        String token = loginAs("ganadero-event", "AnimalEvent9");

        given()
                .auth().oauth2(token)
                .when()
                .get("/api/animals/{uuid}/events", otherAnimalUuid)
                .then()
                .statusCode(403);
    }

    @Test
    void shouldCreateCastrationEventAndProjectBueyCategory() {
        UUID animalUuid = UUID.fromString("d5c7e7ef-57ee-41c1-bfdf-2d6f1c8b77f4");
        seedAnimal(animalUuid);
        QuarkusTransaction.requiringNew().run(() -> {
            Animal animal = animalRepository.findByUuid(animalUuid).orElseThrow();
            animal.setCategory(AnimalCategory.TERNERO);
            animal.setSex(AnimalSex.MACHO);
        });

        String token = loginAs("animal-event-admin", "AnimalEvent9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .header("X-Operation-Id", "a0f115cc-8470-4bd6-abde-b31fd92a7b3a")
                .body("""
                        {
                          "animalUuid": "%s",
                          "type": "CASTRATION",
                          "occurredAt": "2026-04-27T10:00:00Z",
                          "notes": "Castración programada",
                          "sourceChannel": "ONLINE",
                          "operationId": "a0f115cc-8470-4bd6-abde-b31fd92a7b3a",
                          "metadata": {"reasonCode": "SCHEDULED"},
                          "clientCreatedAt": "2026-04-27T10:00:10Z"
                        }
                        """.formatted(animalUuid))
                .when()
                .post("/api/animals/{uuid}/events", animalUuid)
                .then()
                .statusCode(201)
                .body("type", equalTo("CASTRATION"))
                .body("category", equalTo("BUEY"));
    }

    private String loginAs(String username, String password) {
        return given()
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "username": "%s",
                          "password": "%s"
                        }
                        """.formatted(username, password))
                .when()
                .post("/api/auth/login")
                .then()
                .statusCode(200)
                .extract()
                .path("accessToken");
    }

    private User buildUser(String username, String email, String password) {
        return buildUser(username, email, password, Role.ADMIN);
    }

    private User buildUser(String username, String email, String password, Role role) {
        User user = new User();
        user.setId(role == Role.ADMIN ? USER_ID : UUID.nameUUIDFromBytes(username.getBytes()));
        user.setUsername(username);
        user.setEmail(email);
        user.setDisplayName(username);
        user.setPasswordHash(passwordHasher.hash(password));
        user.setRole(role);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }

    private Ganadero buildGanadero(UUID id, String businessIdentifier, String name) {
        return buildGanadero(id, businessIdentifier, name, null);
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

    private void seedAnimal(UUID animalUuid) {
        seedAnimal(animalUuid, OWNER_ID);
    }

    private void seedAnimal(UUID animalUuid, UUID ownerId) {
        QuarkusTransaction.requiringNew().run(() -> {
            Animal animal = new Animal();
            animal.setUuid(animalUuid);
            animal.setCode("CODE-" + animalUuid);
            animal.setTag("TAG-" + animalUuid);
            animal.setArete("AR-" + animalUuid.toString().substring(0, 8));
            animal.setAreteNormalized(animal.getArete().toLowerCase());
            animal.setMarca("Marca Norte");
            animal.setMarcaNormalized("marca norte");
            animal.setOwnerGanadero(ganaderoRepository.findByIdOptional(ownerId).orElseThrow());
            animal.setCategory(AnimalCategory.VACA);
            animal.setSex(AnimalSex.HEMBRA);
            animal.setActive(true);
            animal.setAdmissionDate(LocalDate.of(2024, 1, 1));
            animal.setWeightKg(new BigDecimal("410.00"));
            animal.setCreatedAt(LocalDateTime.of(2026, 4, 26, 8, 0));
            animal.setUpdatedAt(LocalDateTime.of(2026, 4, 26, 8, 0));
            animal.setVersion(0L);
            animalRepository.persist(animal);
        });
    }

    private void seedEvent(UUID animalUuid, AnimalEventType type, String occurredAt, UUID operationId) {
        QuarkusTransaction.requiringNew().run(() -> {
            AnimalEvent event = new AnimalEvent();
            event.setEventId(operationId);
            event.setAnimal(animalRepository.findByUuid(animalUuid).orElseThrow());
            event.setType(type);
            event.setOccurredAt(LocalDateTime.parse(occurredAt));
            event.setClientCreatedAt(LocalDateTime.parse(occurredAt).plusMinutes(1));
            event.setNotes("Notas " + type);
            event.setPerformedByUserId(USER_ID);
            event.setSourceChannel("OFFLINE");
            event.setOperationId(operationId);
            event.setMetadataJson(type == AnimalEventType.OBSERVATION ? "{\"reasonCode\":\"NOTE\"}" : "{\"reasonCode\":\"SALE\"}");
            event.setCreatedAt(LocalDateTime.parse(occurredAt).plusMinutes(type == AnimalEventType.SOLD ? 1 : operationId.equals(UUID.fromString("00000000-0000-0000-0000-000000000200")) ? 2 : 3));
            event.setUpdatedAt(event.getCreatedAt());
            animalEventLogRepository.persist(mapper.toAnimalEventLog(event));
        });
    }
}

package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.AnimalEvent;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalEventType;
import bo.pasorapa.hato.repository.AnimalEventRepository;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
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
    AnimalEventRepository animalEventRepository;

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
        User user = new User();
        user.setId(USER_ID);
        user.setUsername(username);
        user.setEmail(email);
        user.setDisplayName(username);
        user.setPasswordHash(passwordHasher.hash(password));
        user.setRole(Role.ADMIN);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }

    private Ganadero buildGanadero(UUID id, String businessIdentifier, String name) {
        Ganadero ganadero = new Ganadero();
        ganadero.setId(id);
        ganadero.setBusinessIdentifier(businessIdentifier);
        ganadero.setName(name);
        ganadero.setActive(true);
        return ganadero;
    }

    private void seedAnimal(UUID animalUuid) {
        QuarkusTransaction.requiringNew().run(() -> {
            Animal animal = new Animal();
            animal.setUuid(animalUuid);
            animal.setCode("CODE-" + animalUuid);
            animal.setTag("TAG-" + animalUuid);
            animal.setArete("AR-" + animalUuid.toString().substring(0, 8));
            animal.setAreteNormalized(animal.getArete().toLowerCase());
            animal.setMarca("Marca Norte");
            animal.setMarcaNormalized("marca norte");
            animal.setOwnerGanadero(ganaderoRepository.findByIdOptional(OWNER_ID).orElseThrow());
            animal.setCategory(AnimalCategory.COW);
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
            animalEventRepository.persist(event);
        });
    }
}

package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.AnimalHealthEvent;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalHealthEventType;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.repository.AnimalHealthEventRepository;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.mapper.AnimalHealthEventMapper;
import bo.pasorapa.hato.service.security.PasswordHasher;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AnimalHealthEventResourceTest {

    private static final UUID OWNER_ID = UUID.fromString("ae2cb895-826c-4983-b769-df6948df379e");
    private static final UUID USER_ID = UUID.fromString("8a20f320-0247-4df1-9b1f-4920d7b4bd14");

    @Inject
    UserRepository userRepository;

    @Inject
    AnimalRepository animalRepository;

    @Inject
    AnimalHealthEventRepository animalHealthEventRepository;

    @Inject
    GanaderoRepository ganaderoRepository;

    @Inject
    PasswordHasher passwordHasher;

    @Inject
    AnimalHealthEventMapper mapper;

    @Inject
    IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            integrationDatabaseCleaner.clean();
            userRepository.persist(buildUser("animal-health-admin", "animal-health-admin@hato.bo", "AnimalHealth9"));
            ganaderoRepository.persist(buildGanadero());
        });
    }

    @Test
    void shouldListAnimalHealthEventsUsingFiltersAndDeterministicOrdering() {
        UUID animalUuid = UUID.fromString("850009bb-f226-42e2-aaf3-c52edcfd16fc");
        seedAnimal(animalUuid);
        seedEvent(animalUuid, AnimalHealthEventType.VACCINATION, "2026-04-26T10:00:00", "event-200", Map.of("productName", "Brucelosis"));
        seedEvent(animalUuid, AnimalHealthEventType.DEWORMING, "2026-04-26T09:00:00", "event-100", Map.of("productName", "Ivermectina"));
        seedEvent(animalUuid, AnimalHealthEventType.VACCINATION, "2026-04-26T10:00:00", "event-300", Map.of("productName", "Refuerzo"));

        String token = loginAs("animal-health-admin", "AnimalHealth9");

        given()
                .auth().oauth2(token)
                .queryParam("healthEventType", "VACCINATION")
                .queryParam("occurredFrom", "2026-04-26T09:30:00Z")
                .queryParam("occurredTo", "2026-04-26T10:30:00Z")
                .when()
                .get("/api/animals/{uuid}/health-events", animalUuid)
                .then()
                .statusCode(200)
                .body("items", hasSize(2))
                .body("items[0].operationId", equalTo("00000000-0000-0000-0000-000000000200"))
                .body("items[1].operationId", equalTo("00000000-0000-0000-0000-000000000300"))
                .body("items[0].healthEventType", equalTo("VACCINATION"));
    }

    @Test
    void shouldFilterFieldVetVisitsByVisitIdAndExposeDerivedStatus() {
        UUID animalUuid = UUID.fromString("950009bb-f226-42e2-aaf3-c52edcfd16fc");
        seedAnimal(animalUuid);
        seedEvent(animalUuid, AnimalHealthEventType.FIELD_VET_VISIT, "2026-04-26T10:00:00", "event-200", fieldVetMetadata("VISIT-100", "STARTED", null));
        seedEvent(animalUuid, AnimalHealthEventType.FIELD_VET_VISIT, "2026-04-26T12:00:00", "event-300", fieldVetMetadata("VISIT-100", "FOLLOW_UP_REQUIRED", "2026-04-29T10:00:00Z"));
        seedEvent(animalUuid, AnimalHealthEventType.FIELD_VET_VISIT, "2026-04-26T14:00:00", "event-400", fieldVetMetadata("VISIT-200", "STARTED", null));

        String token = loginAs("animal-health-admin", "AnimalHealth9");

        given()
                .auth().oauth2(token)
                .queryParam("healthEventType", "FIELD_VET_VISIT")
                .queryParam("visitId", "VISIT-100")
                .when()
                .get("/api/animals/{uuid}/health-events", animalUuid)
                .then()
                .statusCode(200)
                .body("items", hasSize(2))
                .body("items[0].visitId", equalTo("VISIT-100"))
                .body("items[0].followUpStatus", equalTo("ACTIVE"))
                .body("items[0].metadata.visit.visitId", equalTo("VISIT-100"))
                .body("items[1].nextDueAt", equalTo("2026-04-29T10:00:00Z"));
    }

    @Test
    void shouldListOnlyEventsForRequestedAnimalWithoutLeakingOtherAnimals() {
        UUID requestedAnimalUuid = UUID.fromString("850009bb-f226-42e2-aaf3-c52edcfd16fc");
        UUID otherAnimalUuid = UUID.fromString("d431f469-2572-469f-bad1-bef3e52ec9dd");
        seedAnimal(requestedAnimalUuid);
        seedAnimal(otherAnimalUuid);
        seedEvent(requestedAnimalUuid, AnimalHealthEventType.DISEASE_REPORTED, "2026-04-26T10:00:00", "event-400", Map.of("diagnosisCode", "RESP-01"));
        seedEvent(otherAnimalUuid, AnimalHealthEventType.VACCINATION, "2026-04-26T11:00:00", "event-500", Map.of("productName", "Brucelosis"));

        String token = loginAs("animal-health-admin", "AnimalHealth9");

        given()
                .auth().oauth2(token)
                .when()
                .get("/api/animals/{uuid}/health-events", requestedAnimalUuid)
                .then()
                .statusCode(200)
                .body("items", hasSize(1))
                .body("items[0].animalUuid", equalTo(requestedAnimalUuid.toString()))
                .body("items[0].operationId", equalTo("00000000-0000-0000-0000-000000000400"));
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

    private Ganadero buildGanadero() {
        Ganadero ganadero = new Ganadero();
        ganadero.setId(OWNER_ID);
        ganadero.setBusinessIdentifier("NIT-HEALTH-OWNER");
        ganadero.setName("Ganadero Salud");
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

    private void seedEvent(UUID animalUuid, AnimalHealthEventType type, String occurredAt, String suffix, Map<String, Object> metadata) {
        QuarkusTransaction.requiringNew().run(() -> {
            AnimalHealthEvent event = new AnimalHealthEvent();
            event.setEventId(UUID.randomUUID());
            event.setAnimal(animalRepository.findByUuid(animalUuid).orElseThrow());
            event.setHealthEventType(type);
            event.setOccurredAt(LocalDateTime.parse(occurredAt));
            event.setClientCreatedAt(LocalDateTime.parse(occurredAt).plusMinutes(1));
            event.setNotes("Notas " + type);
            event.setPerformedByUserId(USER_ID);
            event.setSourceChannel("OFFLINE");
            event.setOperationId(UUID.fromString("00000000-0000-0000-0000-000000000" + suffix.substring(suffix.length() - 3)));
            event.setMetadataJson(mapper.writeMetadataJson(metadata));
            event.setCreatedAt(LocalDateTime.parse(occurredAt).plusMinutes(suffix.endsWith("100") ? 1 : suffix.endsWith("200") ? 2 : 3));
            event.setUpdatedAt(event.getCreatedAt());
            animalHealthEventRepository.persist(event);
        });
    }

    private Map<String, Object> fieldVetMetadata(String visitId, String status, String nextDueAt) {
        LinkedHashMap<String, Object> protocol = new LinkedHashMap<>();
        protocol.put("status", status);
        if (nextDueAt != null) {
            protocol.put("nextDueAt", nextDueAt);
        }

        return Map.of(
                "visit", Map.of("visitId", visitId),
                "checklist", List.of(Map.of("code", "TEMPERATURE", "ok", true)),
                "clinicalNote", Map.of("reason", "Control", "findings", "Ok", "plan", "Seguir"),
                "protocol", protocol);
    }
}

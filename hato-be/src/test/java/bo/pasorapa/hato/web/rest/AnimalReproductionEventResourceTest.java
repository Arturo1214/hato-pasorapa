package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.notNullValue;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.service.model.AnimalReproductionEvent;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalReproductionEventType;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.repository.AnimalEventLogRepository;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import bo.pasorapa.hato.service.mapper.AnimalReproductionEventMapper;
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
class AnimalReproductionEventResourceTest {

    private static final UUID OWNER_ID = UUID.fromString("ae2cb895-826c-4983-b769-df6948df379e");
    private static final UUID USER_ID = UUID.fromString("8a20f320-0247-4df1-9b1f-4920d7b4bd14");

    @Inject
    UserRepository userRepository;

    @Inject
    AnimalRepository animalRepository;

    @Inject
    AnimalEventLogRepository animalEventLogRepository;

    @Inject
    GanaderoRepository ganaderoRepository;

    @Inject
    PasswordHasher passwordHasher;

    @Inject
    AnimalReproductionEventMapper mapper;

    @Inject
    IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            integrationDatabaseCleaner.clean();
            userRepository.persist(buildUser("animal-repro-admin", "animal-repro-admin@hato.bo", "AnimalRepro9"));
            ganaderoRepository.persist(buildGanadero());
        });
    }

    @Test
    void shouldListAnimalReproductionEventsUsingDeterministicDescendingOrdering() {
        UUID animalUuid = UUID.fromString("850009bb-f226-42e2-aaf3-c52edcfd16fc");
        seedAnimal(animalUuid);
        seedEvent(animalUuid, AnimalReproductionEventType.SERVICE, "2026-04-26T09:00:00", "event-100", Map.of("serviceMethod", "NATURAL"));
        seedEvent(animalUuid, AnimalReproductionEventType.BIRTH, "2026-04-26T10:00:00", "event-200", Map.of(
                "birthDate", "2026-04-26T10:00:00Z",
                "offspringCount", 0,
                "motherAnimalUuid", animalUuid.toString()));
        seedEvent(animalUuid, AnimalReproductionEventType.PREGNANCY_CONFIRMED, "2026-04-26T11:00:00", "event-300", Map.of("confirmationDate", "2026-04-26T11:00:00Z"));

        String token = loginAs("animal-repro-admin", "AnimalRepro9");

        given()
                .auth().oauth2(token)
                .queryParam("occurredFrom", "2026-04-26T08:30:00Z")
                .queryParam("occurredTo", "2026-04-26T11:30:00Z")
                .when()
                .get("/api/animals/{uuid}/reproduction-events", animalUuid)
                .then()
                .statusCode(200)
                .body("items", hasSize(3))
                .body("items[0].operationId", equalTo("00000000-0000-0000-0000-000000000300"))
                .body("items[1].operationId", equalTo("00000000-0000-0000-0000-000000000200"))
                .body("items[2].operationId", equalTo("00000000-0000-0000-0000-000000000100"));
    }

    @Test
    void shouldListOnlyEventsForRequestedAnimalWithoutLeakingOtherAnimals() {
        UUID requestedAnimalUuid = UUID.fromString("850009bb-f226-42e2-aaf3-c52edcfd16fc");
        UUID otherAnimalUuid = UUID.fromString("d431f469-2572-469f-bad1-bef3e52ec9dd");
        seedAnimal(requestedAnimalUuid);
        seedAnimal(otherAnimalUuid);
        seedEvent(requestedAnimalUuid, AnimalReproductionEventType.BIRTH, "2026-04-26T10:00:00", "event-400", Map.of(
                "birthDate", "2026-04-26T10:00:00Z",
                "offspringCount", 0,
                "motherAnimalUuid", requestedAnimalUuid.toString()));
        seedEvent(otherAnimalUuid, AnimalReproductionEventType.SERVICE, "2026-04-26T11:00:00", "event-500", Map.of("serviceMethod", "NATURAL"));

        String token = loginAs("animal-repro-admin", "AnimalRepro9");

        given()
                .auth().oauth2(token)
                .queryParam("reproductionEventType", "BIRTH")
                .when()
                .get("/api/animals/{uuid}/reproduction-events", requestedAnimalUuid)
                .then()
                .statusCode(200)
                .body("items", hasSize(1))
                .body("items[0].animalUuid", equalTo(requestedAnimalUuid.toString()))
                .body("items[0].operationId", equalTo("00000000-0000-0000-0000-000000000400"));
    }

    @Test
    void shouldCreateNaturalMountServiceEventForFemaleAnimal() {
        UUID animalUuid = UUID.fromString("850009bb-f226-42e2-aaf3-c52edcfd16fc");
        UUID sireUuid = UUID.fromString("23df2de0-1095-4480-9f57-c43fdd60abe2");
        seedAnimal(animalUuid, AnimalSex.HEMBRA, OWNER_ID);
        seedAnimal(sireUuid, AnimalSex.MACHO, OWNER_ID);

        String token = loginAs("animal-repro-admin", "AnimalRepro9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "occurredAt": "2026-05-10T09:30:00Z",
                          "serviceMethod": "MONTA_NATURAL",
                          "fatherAnimalUuid": "%s",
                          "notes": "Servicio reproductivo controlado"
                        }
                        """.formatted(sireUuid))
                .when()
                .post("/api/animals/{uuid}/reproduction-events", animalUuid)
                .then()
                .statusCode(201)
                .body("id", notNullValue())
                .body("animalUuid", equalTo(animalUuid.toString()))
                .body("reproductionEventType", equalTo("SERVICE"))
                .body("metadata.serviceMethod", equalTo("MONTA_NATURAL"))
                .body("metadata.fatherAnimalUuid", equalTo(sireUuid.toString()));
    }

    @Test
    void shouldRejectArtificialInseminationServiceForMaleAnimal() {
        UUID animalUuid = UUID.fromString("d431f469-2572-469f-bad1-bef3e52ec9dd");
        seedAnimal(animalUuid, AnimalSex.MACHO, OWNER_ID);

        String token = loginAs("animal-repro-admin", "AnimalRepro9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "occurredAt": "2026-05-10T09:30:00Z",
                          "serviceMethod": "INSEMINACION_ARTIFICIAL",
                          "semenReference": "Pajuela IA-88"
                        }
                        """)
                .when()
                .post("/api/animals/{uuid}/reproduction-events", animalUuid)
                .then()
                .statusCode(400);
    }

    @Test
    void shouldCreatePositivePregnancyDiagnosisForFemaleAnimal() {
        UUID animalUuid = UUID.fromString("a431f469-2572-469f-bad1-bef3e52ec9aa");
        seedAnimal(animalUuid, AnimalSex.HEMBRA, OWNER_ID);
        UUID serviceEventId = seedEvent(
                animalUuid,
                AnimalReproductionEventType.SERVICE,
                "2026-05-01T09:00:00",
                "event-600",
                Map.of("serviceMethod", "INSEMINACION_ARTIFICIAL", "semenReference", "IA-88"));

        String token = loginAs("animal-repro-admin", "AnimalRepro9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "diagnosisDate": "2026-05-10T09:30:00Z",
                          "result": "PRENADA",
                          "expectedBirthDate": "2027-02-14T00:00:00Z",
                          "serviceEventUuid": "%s",
                          "notes": "Ecografía positiva"
                        }
                        """.formatted(serviceEventId))
                .when()
                .post("/api/animals/{uuid}/reproduction-events/pregnancy-diagnosis", animalUuid)
                .then()
                .statusCode(201)
                .body("reproductionEventType", equalTo("PREGNANCY_DIAGNOSIS"))
                .body("metadata.result", equalTo("PRENADA"))
                .body("metadata.expectedBirthDate", equalTo("2027-02-14T00:00Z"))
                .body("metadata.serviceEventUuid", equalTo(serviceEventId.toString()));
    }

    @Test
    void shouldRejectPregnancyDiagnosisWhenLinkedEventIsNotAService() {
        UUID animalUuid = UUID.fromString("a431f469-2572-469f-bad1-bef3e52ec9ac");
        seedAnimal(animalUuid, AnimalSex.HEMBRA, OWNER_ID);
        UUID diagnosisEventId = seedEvent(
                animalUuid,
                AnimalReproductionEventType.PREGNANCY_DIAGNOSIS,
                "2026-05-01T09:00:00",
                "event-700",
                Map.of("diagnosisDate", "2026-05-01T09:00:00Z", "result", "PRENADA"));

        String token = loginAs("animal-repro-admin", "AnimalRepro9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "diagnosisDate": "2026-05-10T09:30:00Z",
                          "result": "PRENADA",
                          "serviceEventUuid": "%s"
                        }
                        """.formatted(diagnosisEventId))
                .when()
                .post("/api/animals/{uuid}/reproduction-events/pregnancy-diagnosis", animalUuid)
                .then()
                .statusCode(400);
    }

    @Test
    void shouldCreateNegativePregnancyDiagnosisWithFailureMetadata() {
        UUID animalUuid = UUID.fromString("b431f469-2572-469f-bad1-bef3e52ec9bb");
        seedAnimal(animalUuid, AnimalSex.HEMBRA, OWNER_ID);

        String token = loginAs("animal-repro-admin", "AnimalRepro9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "diagnosisDate": "2026-05-10T09:30:00Z",
                          "result": "NO_PRENADA",
                          "notes": "No preñada al tacto"
                        }
                        """)
                .when()
                .post("/api/animals/{uuid}/reproduction-events/pregnancy-diagnosis", animalUuid)
                .then()
                .statusCode(201)
                .body("reproductionEventType", equalTo("PREGNANCY_DIAGNOSIS"))
                .body("metadata.result", equalTo("NO_PRENADA"))
                .body("metadata.status", equalTo("fallo"))
                .body("metadata.negativeResult", equalTo(true));
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
        ganadero.setBusinessIdentifier("NIT-REPRO-OWNER");
        ganadero.setName("Ganadero Repro");
        ganadero.setActive(true);
        return ganadero;
    }

    private void seedAnimal(UUID animalUuid) {
        seedAnimal(animalUuid, AnimalSex.HEMBRA, OWNER_ID);
    }

    private void seedAnimal(UUID animalUuid, AnimalSex sex, UUID ownerId) {
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
            animal.setCategory(sex == AnimalSex.HEMBRA ? AnimalCategory.VACA : AnimalCategory.TORO);
            animal.setSex(sex);
            animal.setActive(true);
            animal.setAdmissionDate(LocalDate.of(2024, 1, 1));
            animal.setWeightKg(new BigDecimal("410.00"));
            animal.setCreatedAt(LocalDateTime.of(2026, 4, 26, 8, 0));
            animal.setUpdatedAt(LocalDateTime.of(2026, 4, 26, 8, 0));
            animal.setVersion(0L);
            animalRepository.persist(animal);
        });
    }

    private UUID seedEvent(UUID animalUuid, AnimalReproductionEventType type, String occurredAt, String suffix, Map<String, Object> metadata) {
        return QuarkusTransaction.requiringNew().call(() -> {
            AnimalReproductionEvent event = new AnimalReproductionEvent();
            UUID eventId = UUID.randomUUID();
            event.setEventId(eventId);
            event.setAnimal(animalRepository.findByUuid(animalUuid).orElseThrow());
            event.setReproductionEventType(type);
            event.setOccurredAt(LocalDateTime.parse(occurredAt));
            event.setClientCreatedAt(LocalDateTime.parse(occurredAt).plusMinutes(1));
            event.setNotes("Notas " + type);
            event.setPerformedByUserId(USER_ID);
            event.setSourceChannel("OFFLINE");
            event.setOperationId(UUID.fromString("00000000-0000-0000-0000-000000000" + suffix.substring(suffix.length() - 3)));
            event.setMetadataJson(mapper.writeMetadataJson(metadata));
            event.setCreatedAt(LocalDateTime.parse(occurredAt).plusMinutes(suffix.endsWith("100") ? 1 : suffix.endsWith("200") ? 2 : 3));
            event.setUpdatedAt(event.getCreatedAt());
            animalEventLogRepository.persist(mapper.toAnimalEventLog(event));
            return eventId;
        });
    }
}

package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;

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
class VetVisitResourceTest {

    private static final UUID OWNER_ID = UUID.fromString("ae2cb895-826c-4983-b769-df6948df379e");
    private static final UUID OTHER_OWNER_ID = UUID.fromString("7b946121-9858-4130-b206-8fb1f27e16b1");
    private static final UUID USER_ID = UUID.fromString("8a20f320-0247-4df1-9b1f-4920d7b4bd14");
    private static final UUID GANADERO_USER_ID = UUID.fromString("b24cf2ba-ff0c-4822-a7a0-040d60850449");
    private static final UUID GLOBAL_ANIMAL_ONE = UUID.fromString("340009bb-f226-42e2-aaf3-c52edcfd16fc");
    private static final UUID GLOBAL_ANIMAL_TWO = UUID.fromString("440009bb-f226-42e2-aaf3-c52edcfd16fc");
    private static final UUID SPECIFIC_ANIMAL = UUID.fromString("540009bb-f226-42e2-aaf3-c52edcfd16fc");
    private static final UUID OTHER_OWNER_ANIMAL = UUID.fromString("640009bb-f226-42e2-aaf3-c52edcfd16fc");

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
            userRepository.persist(buildUser("vet-visits-admin", "vet-visits-admin@hato.bo", "VetVisitsAdmin9", Role.ADMIN, USER_ID));
            userRepository.persist(buildUser("vet-visits-ganadero", "vet-visits-ganadero@hato.bo", "VetVisitsGanadero9", Role.GANADERO, GANADERO_USER_ID));
            ganaderoRepository.persist(buildGanadero(OWNER_ID, "NIT-VET-OWNER", "Ganadero Vet", "vet-visits-ganadero@hato.bo"));
            ganaderoRepository.persist(buildGanadero(OTHER_OWNER_ID, "NIT-VET-OTHER", "Ganadero Otro", "vet-visits-other@hato.bo"));
        });
    }

    @Test
    void shouldListVetVisitsGroupedByGlobalVisitAndFilterByModeStatusAndPagination() {
        seedAnimal(GLOBAL_ANIMAL_ONE, OWNER_ID);
        seedAnimal(GLOBAL_ANIMAL_TWO, OWNER_ID);
        seedAnimal(SPECIFIC_ANIMAL, OWNER_ID);
        seedAnimal(OTHER_OWNER_ANIMAL, OTHER_OWNER_ID);
        seedEvent(GLOBAL_ANIMAL_ONE, "2026-05-10T08:00:00", "event-100", vetVisitMetadata("VISIT-GLOBAL-1", "GLOBAL", "PENDING", "Dra. Ana", "MAT-1", "2026-05-20T08:00:00Z", 2, "Campaña inicial"));
        seedEvent(GLOBAL_ANIMAL_TWO, "2026-05-10T08:00:00", "event-101", vetVisitMetadata("VISIT-GLOBAL-1", "GLOBAL", "PENDING", "Dra. Ana", "MAT-1", "2026-05-20T08:00:00Z", 2, "Campaña inicial"));
        seedEvent(SPECIFIC_ANIMAL, "2026-05-09T09:00:00", "event-200", vetVisitMetadata("VISIT-SPECIFIC-1", "SPECIFIC", "ATTENDED", "Dr. Luis", null, null, 1, "Atención puntual"));
        seedEvent(OTHER_OWNER_ANIMAL, "2026-05-11T09:00:00", "event-300", vetVisitMetadata("VISIT-OTHER-1", "GLOBAL", "PENDING", "Dra. Externa", null, null, 1, "Otro dueño"));

        String token = loginAs("vet-visits-admin", "VetVisitsAdmin9");

        given()
                .auth().oauth2(token)
                .queryParam("mode", "GLOBAL")
                .queryParam("status", "PENDING")
                .queryParam("occurredFrom", "2026-05-09T00:00:00Z")
                .queryParam("occurredTo", "2026-05-10T23:59:59Z")
                .queryParam("page", 0)
                .queryParam("size", 1)
                .when()
                .get("/api/vet-visits")
                .then()
                .statusCode(200)
                .body("items", hasSize(1))
                .body("items[0].visitId", equalTo("VISIT-GLOBAL-1"))
                .body("items[0].mode", equalTo("GLOBAL"))
                .body("items[0].status", equalTo("PENDING"))
                .body("items[0].veterinarian.name", equalTo("Dra. Ana"))
                .body("items[0].veterinarian.license", equalTo("MAT-1"))
                .body("items[0].occurredAt", equalTo("2026-05-10T08:00:00Z"))
                .body("items[0].nextControlAt", equalTo("2026-05-20T08:00:00Z"))
                .body("items[0].animalUuid", nullValue())
                .body("items[0].targetAnimalCount", equalTo(2))
                .body("items[0].atencionNotas", equalTo("Campaña inicial"))
                .body("items[0].costo", nullValue())
                .body("items[0].costCurrency", nullValue())
                .body("items[0].treatmentPlan", equalTo(List.of("Seguir")))
                .body("page", equalTo(0))
                .body("size", equalTo(1))
                .body("total", equalTo(1));
    }

    @Test
    void shouldScopeGanaderoVetVisitListToAuthenticatedOwnerAndKeepSpecificAnimalUuid() {
        seedAnimal(SPECIFIC_ANIMAL, OWNER_ID);
        seedAnimal(OTHER_OWNER_ANIMAL, OTHER_OWNER_ID);
        seedEvent(SPECIFIC_ANIMAL, "2026-05-09T09:00:00", "event-400", vetVisitMetadata("VISIT-SPECIFIC-OWN", "SPECIFIC", "ATTENDED", "Dr. Luis", null, null, 1, "Atención propia"));
        seedEvent(OTHER_OWNER_ANIMAL, "2026-05-10T09:00:00", "event-500", vetVisitMetadata("VISIT-SPECIFIC-OTHER", "SPECIFIC", "ATTENDED", "Dra. Otra", null, null, 1, "Atención ajena"));

        String token = loginAs("vet-visits-ganadero", "VetVisitsGanadero9");

        given()
                .auth().oauth2(token)
                .queryParam("mode", "SPECIFIC")
                .when()
                .get("/api/vet-visits")
                .then()
                .statusCode(200)
                .body("items", hasSize(1))
                .body("items[0].visitId", equalTo("VISIT-SPECIFIC-OWN"))
                .body("items[0].animalUuid", equalTo(SPECIFIC_ANIMAL.toString()))
                .body("total", equalTo(1));
    }

    @Test
    void shouldProjectVetVisitCostCurrencyAndTreatmentPlanInListResponse() {
        seedAnimal(SPECIFIC_ANIMAL, OWNER_ID);
        Map<String, Object> metadata = new LinkedHashMap<>(vetVisitMetadata("VISIT-COST-1", "SPECIFIC", "ATTENDED", "Dr. Luis", null, null, 1, "Atención puntual"));
        metadata.put("cost", Map.of("amount", new BigDecimal("150.50"), "currency", "BOB"));
        metadata.put("clinicalNote", Map.of("reason", "Control", "findings", "Ok", "plan", List.of("Antibiótico", "Control en 7 días")));
        seedEvent(SPECIFIC_ANIMAL, "2026-05-09T09:00:00", "event-600", metadata);

        String token = loginAs("vet-visits-admin", "VetVisitsAdmin9");

        given()
                .auth().oauth2(token)
                .queryParam("mode", "SPECIFIC")
                .when()
                .get("/api/vet-visits")
                .then()
                .statusCode(200)
                .body("items", hasSize(1))
                .body("items[0].visitId", equalTo("VISIT-COST-1"))
                .body("items[0].costo", equalTo(150.50f))
                .body("items[0].costCurrency", equalTo("BOB"))
                .body("items[0].treatmentPlan", equalTo(List.of("Antibiótico", "Control en 7 días")));
    }

    @Test
    void shouldExposeParentVisitCancelReasonAndChainStatusInListResponse() {
        seedAnimal(SPECIFIC_ANIMAL, OWNER_ID);
        Map<String, Object> parent = new LinkedHashMap<>(vetVisitMetadata("VISIT-REST-PARENT", "SPECIFIC", "ATTENDED", "Dr. Luis", null, null, 1, "Atención parent"));
        seedEvent(SPECIFIC_ANIMAL, "2026-05-09T09:00:00", "event-610", parent);
        Map<String, Object> child = new LinkedHashMap<>(vetVisitMetadata("VISIT-REST-CHILD", "SPECIFIC", "CANCELED", "Dr. Luis", null, null, 1, "Atención child"));
        LinkedHashMap<String, Object> visit = new LinkedHashMap<>((Map<String, Object>) child.get("visit"));
        visit.put("parentVisitId", "VISIT-REST-PARENT");
        visit.put("cancelReason", "Animal vendido");
        child.put("visit", visit);
        child.put("cancelReason", "Animal vendido");
        child.put("protocol", Map.of("status", "CLOSED"));
        seedEvent(SPECIFIC_ANIMAL, "2026-05-10T09:00:00", "event-611", child);

        String token = loginAs("vet-visits-admin", "VetVisitsAdmin9");

        given()
                .auth().oauth2(token)
                .queryParam("mode", "SPECIFIC")
                .when()
                .get("/api/vet-visits")
                .then()
                .statusCode(200)
                .body("items.find { it.visitId == 'VISIT-REST-PARENT' }.parentVisitId", nullValue())
                .body("items.find { it.visitId == 'VISIT-REST-PARENT' }.cancelReason", nullValue())
                .body("items.find { it.visitId == 'VISIT-REST-PARENT' }.chainStatus", equalTo("ACTIVE"))
                .body("items.find { it.visitId == 'VISIT-REST-CHILD' }.parentVisitId", equalTo("VISIT-REST-PARENT"))
                .body("items.find { it.visitId == 'VISIT-REST-CHILD' }.cancelReason", equalTo("Animal vendido"))
                .body("items.find { it.visitId == 'VISIT-REST-CHILD' }.chainStatus", equalTo("CLOSED"));
    }

    @Test
    void shouldExposeVisitChainDetailOrderedByParentThenCanceledChild() {
        seedAnimal(SPECIFIC_ANIMAL, OWNER_ID);
        seedEvent(SPECIFIC_ANIMAL, "2026-05-09T09:00:00", "event-620", vetVisitMetadata("VISIT-REST-CHAIN-PARENT", "SPECIFIC", "ATTENDED", "Dr. Luis", null, null, 1, "Parent attended"));
        Map<String, Object> child = new LinkedHashMap<>(vetVisitMetadata("VISIT-REST-CHAIN-CHILD", "SPECIFIC", "CANCELED", "Dr. Luis", null, null, 1, "Child canceled"));
        LinkedHashMap<String, Object> visit = new LinkedHashMap<>((Map<String, Object>) child.get("visit"));
        visit.put("parentVisitId", "VISIT-REST-CHAIN-PARENT");
        visit.put("cancelReason", "Animal movido");
        child.put("visit", visit);
        child.put("cancelReason", "Animal movido");
        child.put("protocol", Map.of("status", "CLOSED"));
        seedEvent(SPECIFIC_ANIMAL, "2026-05-10T09:00:00", "event-621", child);

        String token = loginAs("vet-visits-admin", "VetVisitsAdmin9");

        given()
                .auth().oauth2(token)
                .when()
                .get("/api/vet-visits/VISIT-REST-CHAIN-PARENT/chain")
                .then()
                .statusCode(200)
                .body("items", hasSize(2))
                .body("items[0].visitId", equalTo("VISIT-REST-CHAIN-PARENT"))
                .body("items[0].status", equalTo("ATTENDED"))
                .body("items[0].parentVisitId", nullValue())
                .body("items[1].visitId", equalTo("VISIT-REST-CHAIN-CHILD"))
                .body("items[1].status", equalTo("CANCELED"))
                .body("items[1].parentVisitId", equalTo("VISIT-REST-CHAIN-PARENT"))
                .body("items[1].cancelReason", equalTo("Animal movido"));
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

    private User buildUser(String username, String email, String password, Role role, UUID id) {
        User user = new User();
        user.setId(id);
        user.setUsername(username);
        user.setEmail(email);
        user.setDisplayName(username);
        user.setPasswordHash(passwordHasher.hash(password));
        user.setRole(role);
        user.setStatus(UserStatus.ACTIVE);
        return user;
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
            animal.setCreatedAt(LocalDateTime.of(2026, 5, 9, 8, 0));
            animal.setUpdatedAt(LocalDateTime.of(2026, 5, 9, 8, 0));
            animal.setVersion(0L);
            animalRepository.persist(animal);
        });
    }

    private void seedEvent(UUID animalUuid, String occurredAt, String suffix, Map<String, Object> metadata) {
        QuarkusTransaction.requiringNew().run(() -> {
            AnimalHealthEvent event = new AnimalHealthEvent();
            event.setEventId(UUID.randomUUID());
            event.setAnimal(animalRepository.findByUuid(animalUuid).orElseThrow());
            event.setHealthEventType(AnimalHealthEventType.FIELD_VET_VISIT);
            event.setOccurredAt(LocalDateTime.parse(occurredAt));
            event.setClientCreatedAt(LocalDateTime.parse(occurredAt).plusMinutes(1));
            event.setNotes("Notas FIELD_VET_VISIT");
            event.setPerformedByUserId(USER_ID);
            event.setSourceChannel("OFFLINE");
            event.setOperationId(UUID.fromString("00000000-0000-0000-0000-000000000" + suffix.substring(suffix.length() - 3)));
            event.setMetadataJson(mapper.writeMetadataJson(metadata));
            event.setCreatedAt(LocalDateTime.parse(occurredAt).plusMinutes(1));
            event.setUpdatedAt(event.getCreatedAt());
            animalHealthEventRepository.persist(event);
        });
    }

    private Map<String, Object> vetVisitMetadata(
            String visitId,
            String mode,
            String status,
            String veterinarianName,
            String veterinarianLicense,
            String nextControlAt,
            int targetAnimalCount,
            String atencionNotas) {
        LinkedHashMap<String, Object> veterinarian = new LinkedHashMap<>();
        veterinarian.put("name", veterinarianName);
        veterinarian.put("license", veterinarianLicense);

        LinkedHashMap<String, Object> visit = new LinkedHashMap<>();
        visit.put("visitId", visitId);
        visit.put("mode", mode);
        visit.put("status", status);
        visit.put("veterinarian", veterinarian);
        visit.put("targetAnimalCount", targetAnimalCount);
        visit.put("atencionNotas", atencionNotas);
        if (nextControlAt != null) {
            visit.put("nextControlAt", nextControlAt);
        }

        return Map.of(
                "visit", visit,
                "checklist", List.of(Map.of("code", "TEMPERATURE", "ok", true)),
                "clinicalNote", Map.of("reason", "Control", "findings", "Ok", "plan", "Seguir"),
                "protocol", Map.of("status", "STARTED"));
    }
}

package bo.pasorapa.hato.web.rest;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.equalTo;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.nullValue;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.notNullValue;
import static org.hamcrest.Matchers.hasKey;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import bo.pasorapa.hato.service.security.PasswordHasher;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AnimalResourceTest {

    private static final UUID OWNER_A_ID = UUID.fromString("e469411a-c4cb-4718-b60b-b5c157af5292");
    private static final UUID OWNER_B_ID = UUID.fromString("20c7b2ef-f6ff-454b-976b-cbbfa293e3cf");

    @Inject
    UserRepository userRepository;

    @Inject
    AnimalRepository animalRepository;

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
            userRepository.persist(buildUser("animal-admin", "animal-admin@hato.bo", "AdminAnimal9"));
            userRepository.persist(buildGanaderoUser("animal-ganadero", "ganadero-animal@hato.bo", "GanaderoAnimal9"));
            ganaderoRepository.persist(buildGanadero(OWNER_A_ID, "NIT-ANIMAL-001", "Ganadero Animal", "ganadero-animal@hato.bo"));
            ganaderoRepository.persist(buildGanadero(OWNER_B_ID, "NIT-ANIMAL-002", "Ganadero Sur", "ganadero-sur@hato.bo"));
        });
    }

    @Test
    void shouldCreateReadAndUpdateAnimalUsingCanonicalUuidContract() {
        String token = loginAs("animal-admin", "AdminAnimal9");

        Response created = given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "ownerGanaderoId": "e469411a-c4cb-4718-b60b-b5c157af5292",
                          "arete": "BO-9100",
                          "marca": "HAT-100",
                          "category": "VACA",
                          "sex": "HEMBRA",
                          "active": true,
                          "admissionDate": "2024-02-01",
                          "weightKg": 410.50,
                          "birthDate": "2023-02-01"
                        }
                        """)
                .when()
                .post("/api/animals")
                .then()
                .statusCode(201)
                .body("$", not(hasKey("id")))
                .body("uuid", notNullValue())
                .body("ownerGanaderoId", equalTo("e469411a-c4cb-4718-b60b-b5c157af5292"))
                .body("arete", equalTo("BO-9100"))
                .body("marca", equalTo("HAT-100"))
                .body("version", notNullValue())
                .body("updatedAt", notNullValue())
                .extract()
                .response();

        String uuid = created.path("uuid");

        given()
                .auth().oauth2(token)
                .when()
                .get("/api/animals/{uuid}", uuid)
                .then()
                .statusCode(200)
                .body("$", not(hasKey("id")))
                .body("uuid", equalTo(uuid))
                .body("ownerGanaderoId", equalTo("e469411a-c4cb-4718-b60b-b5c157af5292"))
                .body("arete", equalTo("BO-9100"));

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "ownerGanaderoId": "e469411a-c4cb-4718-b60b-b5c157af5292",
                          "arete": "BO-9101",
                          "marca": "HAT-101",
                          "category": "VACA",
                          "sex": "HEMBRA",
                          "active": true,
                          "admissionDate": "2024-02-01",
                          "weightKg": 420.25,
                          "birthDate": "2023-02-01"
                        }
                        """)
                .when()
                .put("/api/animals/{uuid}", uuid)
                .then()
                .statusCode(200)
                .body("$", not(hasKey("id")))
                .body("uuid", equalTo(uuid))
                .body("arete", equalTo("BO-9101"))
                .body("marca", equalTo("HAT-101"))
                .body("weightKg", equalTo(420.25F));
    }

    @Test
    void shouldRequireOwnerGanaderoIdWhenAnimalIsCreated() {
        String token = loginAs("animal-admin", "AdminAnimal9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "arete": "BO-9100",
                          "category": "VACA",
                          "sex": "HEMBRA",
                          "active": true,
                          "admissionDate": "2024-02-01",
                          "weightKg": 410.50
                        }
                        """)
                .when()
                .post("/api/animals")
                .then()
                .statusCode(400);
    }

    @Test
    void shouldDeriveOwnerFromAuthenticatedGanaderoWhenAnimalIsCreatedWithoutOwnerInPayload() {
        String token = loginAs("animal-ganadero", "GanaderoAnimal9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "arete": "BO-9102",
                          "category": "VACA",
                          "sex": "HEMBRA",
                          "active": true,
                          "admissionDate": "2024-02-01",
                          "weightKg": 410.50
                        }
                        """)
                .when()
                .post("/api/animals")
                .then()
                .statusCode(201)
                .body("ownerGanaderoId", equalTo("e469411a-c4cb-4718-b60b-b5c157af5292"));
    }

    @Test
    void shouldRejectGanaderoOwnerSpoofingThroughRestApi() {
        String token = loginAs("animal-ganadero", "GanaderoAnimal9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "ownerGanaderoId": "20c7b2ef-f6ff-454b-976b-cbbfa293e3cf",
                          "arete": "BO-9103",
                          "category": "VACA",
                          "sex": "HEMBRA",
                          "active": true,
                          "admissionDate": "2024-02-01",
                          "weightKg": 410.50
                        }
                        """)
                .when()
                .post("/api/animals")
                .then()
                .statusCode(403);
    }

    @Test
    void shouldRejectCreateAnimalWithoutSex() {
        String token = loginAs("animal-admin", "AdminAnimal9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "ownerGanaderoId": "e469411a-c4cb-4718-b60b-b5c157af5292",
                          "arete": "BO-9100",
                          "category": "VACA",
                          "active": true,
                          "admissionDate": "2024-02-01",
                          "weightKg": 410.50
                        }
                        """)
                .when()
                .post("/api/animals")
                .then()
                .statusCode(400);
    }

    @Test
    void shouldFilterAnimalsByVisibleOwnerActiveAndCategory() {
        String token = loginAs("animal-admin", "AdminAnimal9");
        UUID ownerA = OWNER_A_ID;
        UUID ownerB = OWNER_B_ID;

        QuarkusTransaction.requiringNew().run(() -> {
            animalRepository.persist(buildAnimal(
                    UUID.fromString("d9a81b4e-faed-4a59-a55d-5fd65f6a3c11"),
                    "legacy-a",
                    "tag-a",
                    ownerA,
                    "ARETE-OPERATIVO-01",
                    null,
                    null,
                    AnimalCategory.VACA,
                    true,
                    LocalDate.of(2024, 2, 1),
                    new BigDecimal("410.50"),
                    LocalDateTime.of(2026, 4, 27, 8, 0, 0),
                    3L));
            animalRepository.persist(buildAnimal(
                    UUID.fromString("d3138ff0-4b7c-4df8-af60-b5968faf5abf"),
                    "legacy-b",
                    "tag-b",
                    ownerA,
                    null,
                    "Marca Secundaria",
                    null,
                    AnimalCategory.VAQUILLONA,
                    true,
                    LocalDate.of(2024, 3, 1),
                    new BigDecimal("350.00"),
                    LocalDateTime.of(2026, 4, 27, 9, 0, 0),
                    2L));
            animalRepository.persist(buildAnimal(
                    UUID.fromString("7d9c636d-0919-49bf-aeb1-97fd8645d4f8"),
                    "legacy-c",
                    "tag-c",
                    ownerB,
                    "ARETE-OPERATIVO-99",
                    null,
                    null,
                    AnimalCategory.VACA,
                    false,
                    LocalDate.of(2024, 4, 1),
                    new BigDecimal("500.00"),
                    LocalDateTime.of(2026, 4, 27, 10, 0, 0),
                    5L));
        });

        given()
                .auth().oauth2(token)
                .when()
                .get("/api/animals?visible.contains=operativo&ownerGanaderoId.equals={owner}&active.equals=true&category.equals=VACA&page=0&size=20&sort=updatedAt,desc", ownerA)
                .then()
                .statusCode(200)
                .body("content", hasSize(1))
                .body("content[0].uuid", equalTo("d9a81b4e-faed-4a59-a55d-5fd65f6a3c11"))
                .body("content[0].ownerGanaderoId", equalTo(ownerA.toString()))
                .body("content[0].arete", equalTo("ARETE-OPERATIVO-01"))
                .body("content[0].category", equalTo("VACA"))
                .body("content[0].active", equalTo(true));
    }

    @Test
    void shouldScopeGanaderoAnimalListToAuthenticatedOwnerAndIgnoreSpoofedOwnerFilter() {
        UUID ownerA = OWNER_A_ID;
        UUID ownerB = OWNER_B_ID;

        QuarkusTransaction.requiringNew().run(() -> {
            animalRepository.persist(buildAnimal(
                    UUID.fromString("1f56f392-0d7a-499b-a4fc-5c8cbe4685a1"),
                    "own-animal",
                    "own-tag",
                    ownerA,
                    "OWN-001",
                    null,
                    null,
                    AnimalCategory.VACA,
                    true,
                    LocalDate.of(2024, 2, 1),
                    new BigDecimal("410.50"),
                    LocalDateTime.of(2026, 4, 27, 8, 0, 0),
                    1L));
            animalRepository.persist(buildAnimal(
                    UUID.fromString("ce68e266-9c60-46db-9f3f-a01e5c94711a"),
                    "other-animal",
                    "other-tag",
                    ownerB,
                    "OTHER-001",
                    null,
                    null,
                    AnimalCategory.VACA,
                    true,
                    LocalDate.of(2024, 2, 1),
                    new BigDecimal("420.50"),
                    LocalDateTime.of(2026, 4, 27, 9, 0, 0),
                    1L));
        });

        String ganaderoToken = loginAs("animal-ganadero", "GanaderoAnimal9");
        given()
                .auth().oauth2(ganaderoToken)
                .when()
                .get("/api/animals?ownerGanaderoId.equals={owner}&page=0&size=20&sort=updatedAt,desc", ownerB)
                .then()
                .statusCode(200)
                .body("content", hasSize(1))
                .body("content[0].uuid", equalTo("1f56f392-0d7a-499b-a4fc-5c8cbe4685a1"))
                .body("content[0].ownerGanaderoId", equalTo(ownerA.toString()));

        String adminToken = loginAs("animal-admin", "AdminAnimal9");
        given()
                .auth().oauth2(adminToken)
                .when()
                .get("/api/animals?page=0&size=20&sort=updatedAt,desc")
                .then()
                .statusCode(200)
                .body("content", hasSize(2));
    }

    @Test
    void shouldRejectInvalidSexCategoryCombination() {
        String token = loginAs("animal-admin", "AdminAnimal9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "ownerGanaderoId": "e469411a-c4cb-4718-b60b-b5c157af5292",
                          "arete": "BO-9199",
                          "category": "VACA",
                          "sex": "MACHO",
                          "active": true,
                          "admissionDate": "2024-02-01",
                          "weightKg": 410.50,
                          "birthDate": "2023-02-01"
                        }
                        """)
                .when()
                .post("/api/animals")
                .then()
                .statusCode(400)
                .body("code", equalTo("INVALID_SEX_CATEGORY_COMBINATION"));
    }

    @Test
    void shouldRequireBirthDateForYoungAnimalCategories() {
        String token = loginAs("animal-admin", "AdminAnimal9");

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "ownerGanaderoId": "e469411a-c4cb-4718-b60b-b5c157af5292",
                          "arete": "BO-9200",
                          "category": "TERNERO",
                          "sex": "MACHO",
                          "active": true,
                          "admissionDate": "2024-02-01",
                          "weightKg": 410.50
                        }
                        """)
                .when()
                .post("/api/animals")
                .then()
                .statusCode(400)
                .body("code", equalTo("BIRTH_DATE_REQUIRED_FOR_YOUNG_ANIMAL"));
    }

    @Test
    void shouldRejectInvalidBooleanFilterForActive() {
        String token = loginAs("animal-admin", "AdminAnimal9");

        given()
                .auth().oauth2(token)
                .when()
                .get("/api/animals?active.equals=si")
                .then()
                .statusCode(400)
                .body("code", equalTo("ANIMAL_INVALID_FILTER"));
    }

    @Test
    void shouldAcceptParentAssignmentWhenParentsBelongToSameOwnerAndMatchSex() {
        String token = loginAs("animal-admin", "AdminAnimal9");
        UUID motherUuid = UUID.fromString("3c0b239a-f0e9-49e8-97db-d1a32e5e1e31");
        UUID fatherUuid = UUID.fromString("1f891ad8-76fc-46e6-8f2b-c7dfd106e61d");

        QuarkusTransaction.requiringNew().run(() -> {
            Animal mother = buildAnimal(motherUuid, "parent-mother", "parent-mother-tag", OWNER_A_ID, "MADRE-FORM", null, null, AnimalCategory.VACA, true, LocalDate.of(2021, 1, 1), new BigDecimal("430.00"), LocalDateTime.of(2026, 4, 27, 8, 0, 0), 1L);
            mother.setSex(AnimalSex.HEMBRA);
            Animal father = buildAnimal(fatherUuid, "parent-father", "parent-father-tag", OWNER_A_ID, "PADRE-FORM", null, null, AnimalCategory.TORO, true, LocalDate.of(2021, 1, 1), new BigDecimal("610.00"), LocalDateTime.of(2026, 4, 27, 8, 5, 0), 1L);
            father.setSex(AnimalSex.MACHO);
            animalRepository.persist(mother, father);
        });

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "ownerGanaderoId": "e469411a-c4cb-4718-b60b-b5c157af5292",
                          "motherAnimalUuid": "%s",
                          "fatherAnimalUuid": "%s",
                          "arete": "CRIA-FORM",
                          "category": "TERNERA",
                          "sex": "HEMBRA",
                          "active": true,
                          "admissionDate": "2026-01-02",
                          "birthDate": "2026-01-01",
                          "weightKg": 90.00
                        }
                        """.formatted(motherUuid, fatherUuid))
                .when()
                .post("/api/animals")
                .then()
                .statusCode(201)
                .body("motherAnimalUuid", equalTo(motherUuid.toString()))
                .body("fatherAnimalUuid", equalTo(fatherUuid.toString()));
    }

    @Test
    void shouldRejectParentAssignmentFromAnotherOwnerOrWrongSex() {
        String token = loginAs("animal-admin", "AdminAnimal9");
        UUID otherOwnerMotherUuid = UUID.fromString("ba44c262-6ce6-4f30-8b10-2eab00b81f61");
        UUID wrongSexFatherUuid = UUID.fromString("b7a91885-d8f8-43b4-9af9-07a09b26f27b");

        QuarkusTransaction.requiringNew().run(() -> {
            Animal otherMother = buildAnimal(otherOwnerMotherUuid, "other-parent", "other-parent-tag", OWNER_B_ID, "MADRE-OTRA", null, null, AnimalCategory.VACA, true, LocalDate.of(2021, 1, 1), new BigDecimal("430.00"), LocalDateTime.of(2026, 4, 27, 8, 0, 0), 1L);
            otherMother.setSex(AnimalSex.HEMBRA);
            Animal wrongSexFather = buildAnimal(wrongSexFatherUuid, "wrong-sex-parent", "wrong-sex-parent-tag", OWNER_A_ID, "PADRE-HEMBRA", null, null, AnimalCategory.VACA, true, LocalDate.of(2021, 1, 1), new BigDecimal("430.00"), LocalDateTime.of(2026, 4, 27, 8, 5, 0), 1L);
            wrongSexFather.setSex(AnimalSex.HEMBRA);
            animalRepository.persist(otherMother, wrongSexFather);
        });

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body(validCalfPayloadWithParents(otherOwnerMotherUuid, null))
                .when()
                .post("/api/animals")
                .then()
                .statusCode(400)
                .body("code", equalTo("ANIMAL_PARENT_OWNER_MISMATCH"));

        given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body(validCalfPayloadWithParents(null, wrongSexFatherUuid))
                .when()
                .post("/api/animals")
                .then()
                .statusCode(400)
                .body("code", equalTo("ANIMAL_FATHER_SEX_INVALID"));
    }

    @Test
    void shouldReturnImmediateGenealogyForAdmin() {
        UUID motherUuid = UUID.fromString("6e8bd52a-9f33-4977-9f1f-08aa718df101");
        UUID fatherUuid = UUID.fromString("b459fe2e-1a98-4e84-b0dd-4ffb7ace5fbb");
        UUID calfUuid = UUID.fromString("f83159e6-03e8-4c07-b810-ff5a5fe8943a");
        UUID siblingUuid = UUID.fromString("0c9a397b-6d2d-41b5-a637-6320c47f2733");

        QuarkusTransaction.requiringNew().run(() -> {
            Animal mother = buildAnimal(motherUuid, "mother-code", "mother-tag", OWNER_A_ID, "MADRE-001", null, null, AnimalCategory.VACA, true, LocalDate.of(2021, 1, 1), new BigDecimal("430.00"), LocalDateTime.of(2026, 4, 27, 8, 0, 0), 1L);
            Animal father = buildAnimal(fatherUuid, "father-code", "father-tag", OWNER_A_ID, "PADRE-001", null, null, AnimalCategory.TORO, true, LocalDate.of(2021, 1, 1), new BigDecimal("610.00"), LocalDateTime.of(2026, 4, 27, 8, 5, 0), 1L);
            Animal calf = buildAnimal(calfUuid, "calf-code", "calf-tag", OWNER_A_ID, "CRIA-001", null, null, AnimalCategory.TERNERA, true, LocalDate.of(2026, 1, 1), new BigDecimal("90.00"), LocalDateTime.of(2026, 4, 27, 8, 10, 0), 1L);
            Animal sibling = buildAnimal(siblingUuid, "sibling-code", "sibling-tag", OWNER_A_ID, "CRIA-002", null, null, AnimalCategory.TERNERA, true, LocalDate.of(2026, 2, 1), new BigDecimal("80.00"), LocalDateTime.of(2026, 4, 27, 8, 15, 0), 1L);
            calf.setMotherAnimalUuid(motherUuid);
            calf.setFatherAnimalUuid(fatherUuid);
            sibling.setMotherAnimalUuid(motherUuid);
            sibling.setFatherAnimalUuid(fatherUuid);
            animalRepository.persist(mother, father, calf, sibling);
        });

        given()
                .auth().oauth2(loginAs("animal-admin", "AdminAnimal9"))
                .when()
                .get("/api/animals/{uuid}/genealogy", calfUuid)
                .then()
                .statusCode(200)
                .body("animal.uuid", equalTo(calfUuid.toString()))
                .body("mother.uuid", equalTo(motherUuid.toString()))
                .body("father.uuid", equalTo(fatherUuid.toString()))
                .body("offspring", hasSize(0));

        given()
                .auth().oauth2(loginAs("animal-admin", "AdminAnimal9"))
                .when()
                .get("/api/animals/{uuid}/genealogy", motherUuid)
                .then()
                .statusCode(200)
                .body("animal.uuid", equalTo(motherUuid.toString()))
                .body("mother", nullValue())
                .body("father", nullValue())
                .body("offspring", hasSize(2))
                .body("offspring[0].ownerGanaderoId", equalTo(OWNER_A_ID.toString()));
    }

    @Test
    void shouldReturnGrandparentsWhenGenealogyGenerationsIsTwo() {
        UUID maternalGrandmotherUuid = UUID.fromString("6ab018e4-e540-47ad-a163-428ac22d0a01");
        UUID maternalGrandfatherUuid = UUID.fromString("822c4950-9d89-465a-9fec-57368aa85e01");
        UUID paternalGrandmotherUuid = UUID.fromString("e288e7d9-9c67-4498-8fd9-bba8c56ac801");
        UUID motherUuid = UUID.fromString("4a5718d4-5a13-4987-89c8-b7f2695dd201");
        UUID fatherUuid = UUID.fromString("78a9869e-a6ef-410f-aa3e-c984f7386501");
        UUID calfUuid = UUID.fromString("43bd6ff7-7f59-4f31-80d5-6111979d7001");

        QuarkusTransaction.requiringNew().run(() -> {
            Animal maternalGrandmother = buildAnimal(maternalGrandmotherUuid, "mgm-code", "mgm-tag", OWNER_A_ID, "ABUELA-M-001", null, null, AnimalCategory.VACA, true, LocalDate.of(2018, 1, 1), new BigDecimal("440.00"), LocalDateTime.of(2026, 4, 27, 7, 0), 1L);
            Animal maternalGrandfather = buildAnimal(maternalGrandfatherUuid, "mgf-code", "mgf-tag", OWNER_A_ID, "ABUELO-M-001", null, null, AnimalCategory.TORO, true, LocalDate.of(2018, 1, 1), new BigDecimal("700.00"), LocalDateTime.of(2026, 4, 27, 7, 1), 1L);
            Animal paternalGrandmother = buildAnimal(paternalGrandmotherUuid, "pgm-code", "pgm-tag", OWNER_A_ID, "ABUELA-P-001", null, null, AnimalCategory.VACA, true, LocalDate.of(2018, 1, 1), new BigDecimal("430.00"), LocalDateTime.of(2026, 4, 27, 7, 2), 1L);
            Animal mother = buildAnimal(motherUuid, "mother-g2-code", "mother-g2-tag", OWNER_A_ID, "MADRE-G2-001", null, null, AnimalCategory.VACA, true, LocalDate.of(2021, 1, 1), new BigDecimal("430.00"), LocalDateTime.of(2026, 4, 27, 8, 0), 1L);
            Animal father = buildAnimal(fatherUuid, "father-g2-code", "father-g2-tag", OWNER_A_ID, "PADRE-G2-001", null, null, AnimalCategory.TORO, true, LocalDate.of(2021, 1, 1), new BigDecimal("610.00"), LocalDateTime.of(2026, 4, 27, 8, 5), 1L);
            Animal calf = buildAnimal(calfUuid, "calf-g2-code", "calf-g2-tag", OWNER_A_ID, "CRIA-G2-001", null, null, AnimalCategory.TERNERA, true, LocalDate.of(2026, 1, 1), new BigDecimal("90.00"), LocalDateTime.of(2026, 4, 27, 8, 10), 1L);
            mother.setMotherAnimalUuid(maternalGrandmotherUuid);
            mother.setFatherAnimalUuid(maternalGrandfatherUuid);
            father.setMotherAnimalUuid(paternalGrandmotherUuid);
            calf.setMotherAnimalUuid(motherUuid);
            calf.setFatherAnimalUuid(fatherUuid);
            animalRepository.persist(maternalGrandmother, maternalGrandfather, paternalGrandmother, mother, father, calf);
        });

        given()
                .auth().oauth2(loginAs("animal-admin", "AdminAnimal9"))
                .queryParam("generations", 2)
                .when()
                .get("/api/animals/{uuid}/genealogy", calfUuid)
                .then()
                .statusCode(200)
                .body("animal.uuid", equalTo(calfUuid.toString()))
                .body("mother.uuid", equalTo(motherUuid.toString()))
                .body("father.uuid", equalTo(fatherUuid.toString()))
                .body("ancestors.animal.uuid", equalTo(calfUuid.toString()))
                .body("ancestors.mother.animal.uuid", equalTo(motherUuid.toString()))
                .body("ancestors.mother.mother.animal.uuid", equalTo(maternalGrandmotherUuid.toString()))
                .body("ancestors.mother.father.animal.uuid", equalTo(maternalGrandfatherUuid.toString()))
                .body("ancestors.father.animal.uuid", equalTo(fatherUuid.toString()))
                .body("ancestors.father.mother.animal.uuid", equalTo(paternalGrandmotherUuid.toString()))
                .body("ancestors.father.father", nullValue());
    }

    @Test
    void shouldClampGenealogyGenerationsToMaximumDepth() {
        UUID greatGreatGrandmotherUuid = UUID.fromString("ffb19672-1f9f-47f6-9a10-67e162592501");
        UUID greatGrandmotherUuid = UUID.fromString("a0cae7a8-52ea-4423-bad0-9350806b9501");
        UUID grandmotherUuid = UUID.fromString("d5f80575-f2e6-495f-80cf-d1d2a4196501");
        UUID motherUuid = UUID.fromString("608699ad-67a7-4618-977e-48c9f1700501");
        UUID calfUuid = UUID.fromString("670ef2ff-91aa-4944-83b5-e5b86a5af501");

        QuarkusTransaction.requiringNew().run(() -> {
            Animal greatGreatGrandmother = buildAnimal(greatGreatGrandmotherUuid, "gggm-code", "gggm-tag", OWNER_A_ID, "TATARABUELA-001", null, null, AnimalCategory.VACA, true, LocalDate.of(2012, 1, 1), new BigDecimal("440.00"), LocalDateTime.of(2026, 4, 27, 6, 0), 1L);
            Animal greatGrandmother = buildAnimal(greatGrandmotherUuid, "ggm-code", "ggm-tag", OWNER_A_ID, "BISABUELA-001", null, null, AnimalCategory.VACA, true, LocalDate.of(2015, 1, 1), new BigDecimal("440.00"), LocalDateTime.of(2026, 4, 27, 7, 0), 1L);
            Animal grandmother = buildAnimal(grandmotherUuid, "gm-code", "gm-tag", OWNER_A_ID, "ABUELA-CLAMP-001", null, null, AnimalCategory.VACA, true, LocalDate.of(2018, 1, 1), new BigDecimal("430.00"), LocalDateTime.of(2026, 4, 27, 8, 0), 1L);
            Animal mother = buildAnimal(motherUuid, "mother-clamp-code", "mother-clamp-tag", OWNER_A_ID, "MADRE-CLAMP-001", null, null, AnimalCategory.VACA, true, LocalDate.of(2021, 1, 1), new BigDecimal("420.00"), LocalDateTime.of(2026, 4, 27, 9, 0), 1L);
            Animal calf = buildAnimal(calfUuid, "calf-clamp-code", "calf-clamp-tag", OWNER_A_ID, "CRIA-CLAMP-001", null, null, AnimalCategory.TERNERA, true, LocalDate.of(2026, 1, 1), new BigDecimal("90.00"), LocalDateTime.of(2026, 4, 27, 10, 0), 1L);
            greatGrandmother.setMotherAnimalUuid(greatGreatGrandmotherUuid);
            grandmother.setMotherAnimalUuid(greatGrandmotherUuid);
            mother.setMotherAnimalUuid(grandmotherUuid);
            calf.setMotherAnimalUuid(motherUuid);
            animalRepository.persist(greatGreatGrandmother, greatGrandmother, grandmother, mother, calf);
        });

        given()
                .auth().oauth2(loginAs("animal-admin", "AdminAnimal9"))
                .queryParam("generations", 99)
                .when()
                .get("/api/animals/{uuid}/genealogy", calfUuid)
                .then()
                .statusCode(200)
                .body("ancestors.mother.mother.mother.animal.uuid", equalTo(greatGrandmotherUuid.toString()))
                .body("ancestors.mother.mother.mother.mother", nullValue());
    }

    @Test
    void shouldScopeGanaderoGenealogyAndDetailToAuthenticatedOwner() {
        UUID ownAnimalUuid = UUID.fromString("4f9d1eaf-2271-42a2-9e4c-6c9d6744c103");
        UUID ownOffspringUuid = UUID.fromString("f5480b65-cc58-45e1-ae78-10f08deababe");
        UUID otherAnimalUuid = UUID.fromString("d013e01f-8564-4f07-8101-31b6953fd4f1");

        QuarkusTransaction.requiringNew().run(() -> {
            Animal ownAnimal = buildAnimal(ownAnimalUuid, "own-code", "own-tag", OWNER_A_ID, "OWN-GEN-001", null, null, AnimalCategory.VACA, true, LocalDate.of(2021, 1, 1), new BigDecimal("430.00"), LocalDateTime.of(2026, 4, 27, 8, 0, 0), 1L);
            Animal ownOffspring = buildAnimal(ownOffspringUuid, "own-child-code", "own-child-tag", OWNER_A_ID, "OWN-GEN-002", null, null, AnimalCategory.TERNERA, true, LocalDate.of(2026, 1, 1), new BigDecimal("90.00"), LocalDateTime.of(2026, 4, 27, 8, 5, 0), 1L);
            Animal otherAnimal = buildAnimal(otherAnimalUuid, "other-code", "other-tag", OWNER_B_ID, "OTHER-GEN-001", null, null, AnimalCategory.TERNERA, true, LocalDate.of(2026, 1, 1), new BigDecimal("90.00"), LocalDateTime.of(2026, 4, 27, 8, 10, 0), 1L);
            ownOffspring.setMotherAnimalUuid(ownAnimalUuid);
            otherAnimal.setMotherAnimalUuid(ownAnimalUuid);
            animalRepository.persist(ownAnimal, ownOffspring, otherAnimal);
        });

        String ganaderoToken = loginAs("animal-ganadero", "GanaderoAnimal9");

        given()
                .auth().oauth2(ganaderoToken)
                .when()
                .get("/api/animals/{uuid}", otherAnimalUuid)
                .then()
                .statusCode(403);

        given()
                .auth().oauth2(ganaderoToken)
                .when()
                .get("/api/animals/{uuid}/genealogy", otherAnimalUuid)
                .then()
                .statusCode(403);

        given()
                .auth().oauth2(ganaderoToken)
                .when()
                .get("/api/animals/{uuid}/genealogy", ownAnimalUuid)
                .then()
                .statusCode(200)
                .body("animal.uuid", equalTo(ownAnimalUuid.toString()))
                .body("offspring", hasSize(1))
                .body("offspring[0].uuid", equalTo(ownOffspringUuid.toString()));
    }

    @Test
    void shouldFilterOutOfOwnerAncestorsForGanaderoGenealogy() {
        UUID otherOwnerGrandmotherUuid = UUID.fromString("8c2ba3d8-b46d-42f3-bcad-0fe02a8a8a01");
        UUID ownMotherUuid = UUID.fromString("5475a31c-fcb7-4868-814b-6774226c9a01");
        UUID ownAnimalUuid = UUID.fromString("af4a3d7b-ee02-48a2-bc50-492456f00a01");

        QuarkusTransaction.requiringNew().run(() -> {
            Animal otherOwnerGrandmother = buildAnimal(otherOwnerGrandmotherUuid, "other-grandmother", "other-grandmother", OWNER_B_ID, "ABUELA-OTRA-001", null, null, AnimalCategory.VACA, true, LocalDate.of(2018, 1, 1), new BigDecimal("430.00"), LocalDateTime.of(2026, 4, 27, 7, 0), 1L);
            Animal ownMother = buildAnimal(ownMotherUuid, "own-mother-g2", "own-mother-g2", OWNER_A_ID, "MADRE-PROPIA-001", null, null, AnimalCategory.VACA, true, LocalDate.of(2021, 1, 1), new BigDecimal("410.00"), LocalDateTime.of(2026, 4, 27, 8, 0), 1L);
            Animal ownAnimal = buildAnimal(ownAnimalUuid, "own-animal-g2", "own-animal-g2", OWNER_A_ID, "CRIA-PROPIA-001", null, null, AnimalCategory.TERNERA, true, LocalDate.of(2026, 1, 1), new BigDecimal("90.00"), LocalDateTime.of(2026, 4, 27, 9, 0), 1L);
            ownMother.setMotherAnimalUuid(otherOwnerGrandmotherUuid);
            ownAnimal.setMotherAnimalUuid(ownMotherUuid);
            animalRepository.persist(otherOwnerGrandmother, ownMother, ownAnimal);
        });

        given()
                .auth().oauth2(loginAs("animal-ganadero", "GanaderoAnimal9"))
                .queryParam("generations", 2)
                .when()
                .get("/api/animals/{uuid}/genealogy", ownAnimalUuid)
                .then()
                .statusCode(200)
                .body("mother.uuid", equalTo(ownMotherUuid.toString()))
                .body("ancestors.mother.animal.uuid", equalTo(ownMotherUuid.toString()))
                .body("ancestors.mother.mother", nullValue());
    }

    @Test
    void shouldRegisterBirthFromMotherDetailCreatingOffspringAndGenealogy() {
        UUID motherUuid = UUID.fromString("37b64046-5ca3-4ef9-b2a5-9ac3e0d0df60");
        UUID fatherUuid = UUID.fromString("a538c85d-99b7-45a3-a65f-1cf5d5826e5b");
        QuarkusTransaction.requiringNew().run(() -> {
            Animal mother = buildAnimal(motherUuid, "birth-mother", "birth-mother", OWNER_A_ID, "MADRE-PARTO-001", null, null, AnimalCategory.VACA, true, LocalDate.of(2023, 1, 1), new BigDecimal("430.00"), LocalDateTime.of(2026, 5, 10, 8, 0), 1L);
            mother.setSex(AnimalSex.HEMBRA);
            Animal father = buildAnimal(fatherUuid, "birth-father", "birth-father", OWNER_A_ID, "PADRE-PARTO-001", null, null, AnimalCategory.TORO, true, LocalDate.of(2022, 1, 1), new BigDecimal("700.00"), LocalDateTime.of(2026, 5, 10, 8, 1), 1L);
            father.setSex(AnimalSex.MACHO);
            animalRepository.persist(mother, father);
        });

        String token = loginAs("animal-admin", "AdminAnimal9");
        Response created = given()
                .auth().oauth2(token)
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "birthDate": "2026-05-10",
                          "fatherAnimalUuid": "a538c85d-99b7-45a3-a65f-1cf5d5826e5b",
                          "notes": "Parto asistido por el encargado",
                          "offspring": [
                            {
                              "arete": "CRIA-PARTO-001",
                              "category": "TERNERA",
                              "sex": "HEMBRA",
                              "active": true,
                              "weightKg": 31.25
                            }
                          ]
                        }
                        """)
                .when()
                .post("/api/animals/{motherUuid}/birth-registration", motherUuid)
                .then()
                .statusCode(201)
                .body("motherAnimalUuid", equalTo(motherUuid.toString()))
                .body("fatherAnimalUuid", equalTo(fatherUuid.toString()))
                .body("birthDate", equalTo("2026-05-10"))
                .body("offspringCount", equalTo(1))
                .body("eventId", notNullValue())
                .body("offspring[0].arete", equalTo("CRIA-PARTO-001"))
                .body("offspring[0].motherAnimalUuid", equalTo(motherUuid.toString()))
                .body("offspring[0].fatherAnimalUuid", equalTo(fatherUuid.toString()))
                .extract()
                .response();

        String calfUuid = created.path("offspring[0].uuid");
        given()
                .auth().oauth2(token)
                .when()
                .get("/api/animals/{uuid}/genealogy", calfUuid)
                .then()
                .statusCode(200)
                .body("mother.uuid", equalTo(motherUuid.toString()))
                .body("father.uuid", equalTo(fatherUuid.toString()));
    }

    @Test
    void shouldRejectBirthRegistrationWhenFatherBelongsToAnotherGanadero() {
        UUID motherUuid = UUID.fromString("cc0afc21-9500-48ef-812e-419b7bc7a79d");
        UUID fatherUuid = UUID.fromString("f18b2660-5242-41e6-82a7-e7208e7090b8");
        QuarkusTransaction.requiringNew().run(() -> {
            Animal mother = buildAnimal(motherUuid, "birth-mother-b", "birth-mother-b", OWNER_A_ID, "MADRE-PARTO-002", null, null, AnimalCategory.VACA, true, LocalDate.of(2023, 1, 1), new BigDecimal("430.00"), LocalDateTime.of(2026, 5, 10, 8, 0), 1L);
            mother.setSex(AnimalSex.HEMBRA);
            Animal father = buildAnimal(fatherUuid, "birth-father-b", "birth-father-b", OWNER_B_ID, "PADRE-PARTO-002", null, null, AnimalCategory.TORO, true, LocalDate.of(2022, 1, 1), new BigDecimal("700.00"), LocalDateTime.of(2026, 5, 10, 8, 1), 1L);
            father.setSex(AnimalSex.MACHO);
            animalRepository.persist(mother, father);
        });

        given()
                .auth().oauth2(loginAs("animal-admin", "AdminAnimal9"))
                .contentType(ContentType.JSON)
                .body("""
                        {
                          "birthDate": "2026-05-10",
                          "fatherAnimalUuid": "f18b2660-5242-41e6-82a7-e7208e7090b8",
                          "offspring": [
                            {
                              "arete": "CRIA-PARTO-002",
                              "category": "TERNERO",
                              "sex": "MACHO",
                              "active": true
                            }
                          ]
                        }
                        """)
                .when()
                .post("/api/animals/{motherUuid}/birth-registration", motherUuid)
                .then()
                .statusCode(400);
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
        user.setId(UUID.randomUUID());
        user.setUsername(username);
        user.setEmail(email);
        user.setDisplayName(username);
        user.setPasswordHash(passwordHasher.hash(password));
        user.setRole(Role.ADMIN);
        user.setStatus(UserStatus.ACTIVE);
        return user;
    }

    private String validCalfPayloadWithParents(UUID motherUuid, UUID fatherUuid) {
        return """
                {
                  "ownerGanaderoId": "e469411a-c4cb-4718-b60b-b5c157af5292",
                  "motherAnimalUuid": %s,
                  "fatherAnimalUuid": %s,
                  "arete": "%s",
                  "category": "TERNERA",
                  "sex": "HEMBRA",
                  "active": true,
                  "admissionDate": "2026-01-02",
                  "birthDate": "2026-01-01",
                  "weightKg": 90.00
                }
                """.formatted(
                motherUuid == null ? "null" : "\"" + motherUuid + "\"",
                fatherUuid == null ? "null" : "\"" + fatherUuid + "\"",
                "CRIA-" + UUID.randomUUID());
    }

    private User buildGanaderoUser(String username, String email, String password) {
        User user = buildUser(username, email, password);
        user.setRole(Role.GANADERO);
        return user;
    }

    private Ganadero buildGanadero(UUID id, String businessIdentifier, String name) {
        return buildGanadero(id, businessIdentifier, name, name.toLowerCase().replace(" ", "-") + "@hato.bo");
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

    private Animal buildAnimal(
            UUID uuid,
            String code,
            String tag,
            UUID ownerGanaderoId,
            String arete,
            String marca,
            String tatuaje,
            AnimalCategory category,
            boolean active,
            LocalDate admissionDate,
            BigDecimal weightKg,
            LocalDateTime updatedAt,
            long version
    ) {
        Animal animal = new Animal();
        animal.setUuid(uuid);
        animal.setCode(code);
        animal.setTag(tag);
        animal.setOwnerGanadero(ganaderoRepository.findById(ownerGanaderoId));
        animal.setArete(arete);
        animal.setMarca(marca);
        animal.setTatuaje(tatuaje);
        animal.setAreteNormalized(normalizeVisible(arete));
        animal.setMarcaNormalized(normalizeVisible(marca));
        animal.setTatuajeNormalized(normalizeVisible(tatuaje));
        animal.setCategory(category);
        animal.setSex(AnimalSex.HEMBRA);
        animal.setActive(active);
        animal.setAdmissionDate(admissionDate);
        animal.setWeightKg(weightKg);
        animal.setCreatedAt(updatedAt.minusHours(1));
        animal.setUpdatedAt(updatedAt);
        animal.setVersion(version);
        animal.setLastSyncedAt(updatedAt);
        return animal;
    }

    private String normalizeVisible(String value) {
        return value == null ? null : value.trim().toLowerCase();
    }
}

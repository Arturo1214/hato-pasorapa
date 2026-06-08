package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.service.model.AnimalReproductionEvent;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalEventCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalReproductionEventType;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.AnimalEventLogRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import bo.pasorapa.hato.service.dto.animalreproductionevent.AnimalReproductionEventRequest;
import bo.pasorapa.hato.service.error.BusinessException;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AnimalReproductionEventServiceTest {

    private static final UUID OWNER_ID = UUID.fromString("83ea4a4f-6f9d-45e3-ba1f-f247857dff67");
    private static final UUID USER_ID = UUID.fromString("196f80b3-c3df-44bc-97eb-20df7c333cac");

    @Inject
    AnimalReproductionEventService animalReproductionEventService;

    @Inject
    AnimalRepository animalRepository;

    @Inject
    AnimalEventLogRepository animalEventLogRepository;

    @Inject
    GanaderoRepository ganaderoRepository;

    @Inject
    UserRepository userRepository;

    @Inject
    IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            integrationDatabaseCleaner.clean();
            ganaderoRepository.persist(buildGanadero());
        });
        seedUser(USER_ID, "repro-admin", "repro-admin@hato.bo", Role.ADMIN);
    }

    @Test
    void shouldCreateServiceAppendOnlyIdempotently() {
        UUID animalUuid = UUID.fromString("0a0da946-dcdb-4732-8ae7-054bc0e5f2ef");
        UUID operationId = UUID.fromString("e11237e7-6880-4f4e-b7db-8b29d38342aa");
        seedAnimal(animalUuid, "AR-service");

        var request = request(
                animalUuid,
                AnimalReproductionEventType.SERVICE,
                operationId,
                "Servicio natural",
                Map.of("serviceMethod", "NATURAL"));

        var created = animalReproductionEventService.create(request, USER_ID);
        var replayed = animalReproductionEventService.create(request, USER_ID);

        assertEquals(operationId, created.getOperationId());
        assertEquals(created.getEventId(), replayed.getEventId());
        assertEquals(1, animalEventLogRepository.count("eventCategory", AnimalEventCategory.REPRODUCTION));
    }

    @Test
    void shouldReadReproductionEventsFromUnifiedLogOnly() {
        UUID animalUuid = UUID.fromString("30303030-3030-4030-8030-303030303030");
        UUID operationId = UUID.fromString("31313131-3131-4131-8131-313131313131");
        seedAnimal(animalUuid, "AR-repro-log");

        AnimalReproductionEvent created = animalReproductionEventService.create(request(
                animalUuid,
                AnimalReproductionEventType.SERVICE,
                operationId,
                "Servicio unified",
                Map.of("serviceMethod", "NATURAL")), USER_ID);
        var listed = animalReproductionEventService.list(animalUuid, AnimalReproductionEventType.SERVICE, null, null);

        assertEquals(operationId, created.getOperationId());
        assertEquals(1, listed.size());
        assertEquals(AnimalReproductionEventType.SERVICE, listed.getFirst().reproductionEventType());
        assertEquals(operationId, listed.getFirst().operationId());
    }

    @Test
    void shouldCreateNaturalMountServiceOnlyForFemaleAnimalAndMaleSireFromSameOwner() {
        UUID femaleUuid = UUID.fromString("01010101-0101-4101-8101-010101010101");
        UUID sireUuid = UUID.fromString("02020202-0202-4202-8202-020202020202");
        seedAnimal(femaleUuid, "AR-hembra-servicio", AnimalSex.HEMBRA, OWNER_ID);
        seedAnimal(sireUuid, "AR-toro-servicio", AnimalSex.MACHO, OWNER_ID);

        var created = animalReproductionEventService.create(request(
                femaleUuid,
                AnimalReproductionEventType.SERVICE,
                UUID.fromString("03030303-0303-4303-8303-030303030303"),
                "Servicio por monta natural",
                Map.of("serviceMethod", "MONTA_NATURAL", "fatherAnimalUuid", sireUuid.toString())), USER_ID);

        assertEquals(AnimalReproductionEventType.SERVICE, created.getReproductionEventType());
        assertEquals(femaleUuid, created.getAnimal().getUuid());
    }

    @Test
    void shouldRejectNaturalMountServiceWhenSireIsNotMaleFromSameOwner() {
        UUID femaleUuid = UUID.fromString("04040404-0404-4404-8404-040404040404");
        UUID wrongOwnerSireUuid = UUID.fromString("05050505-0505-4505-8505-050505050505");
        UUID otherOwnerId = UUID.fromString("06060606-0606-4606-8606-060606060606");
        seedGanadero(otherOwnerId, "NIT-REPRO-OTHER", "Ganadero Repro Otro");
        seedAnimal(femaleUuid, "AR-hembra-owner", AnimalSex.HEMBRA, OWNER_ID);
        seedAnimal(wrongOwnerSireUuid, "AR-toro-other", AnimalSex.MACHO, otherOwnerId);

        BusinessException exception = assertThrows(BusinessException.class, () -> animalReproductionEventService.create(request(
                femaleUuid,
                AnimalReproductionEventType.SERVICE,
                UUID.fromString("07070707-0707-4707-8707-070707070707"),
                "Servicio con toro externo",
                Map.of("serviceMethod", "MONTA_NATURAL", "fatherAnimalUuid", wrongOwnerSireUuid.toString())), USER_ID));

        assertEquals("ANIMAL_REPRODUCTION_EVENT_SERVICE_SIRE_OWNER_MISMATCH", exception.code());
    }

    @Test
    void shouldAllowArtificialInseminationServiceWithBullReferenceAndNoSireAnimal() {
        UUID femaleUuid = UUID.fromString("08080808-0808-4808-8808-080808080808");
        seedAnimal(femaleUuid, "AR-hembra-ia", AnimalSex.HEMBRA, OWNER_ID);

        var created = animalReproductionEventService.create(request(
                femaleUuid,
                AnimalReproductionEventType.SERVICE,
                UUID.fromString("09090909-0909-4909-8909-090909090909"),
                "Servicio por inseminación artificial",
                Map.of("serviceMethod", "INSEMINACION_ARTIFICIAL", "semenReference", "Pajuela toro catálogo IA-77")), USER_ID);

        assertEquals(AnimalReproductionEventType.SERVICE, created.getReproductionEventType());
        assertEquals(femaleUuid, created.getAnimal().getUuid());
    }

    @Test
    void shouldRejectServiceForMaleAnimal() {
        UUID maleUuid = UUID.fromString("10101010-1010-4010-8010-101010101010");
        seedAnimal(maleUuid, "AR-macho-servicio", AnimalSex.MACHO, OWNER_ID);

        BusinessException exception = assertThrows(BusinessException.class, () -> animalReproductionEventService.create(request(
                maleUuid,
                AnimalReproductionEventType.SERVICE,
                UUID.fromString("11111111-2222-4333-8444-555555555555"),
                "Servicio inválido",
                Map.of("serviceMethod", "INSEMINACION_ARTIFICIAL", "bullReference", "Toro externo")), USER_ID));

        assertEquals("ANIMAL_REPRODUCTION_EVENT_FEMALE_REQUIRED", exception.code());
    }

    @Test
    void shouldRejectServiceWhenGanaderoUserDoesNotOwnFemaleAnimal() {
        UUID otherOwnerId = UUID.fromString("12121212-1212-4212-8212-121212121212");
        UUID otherUserId = UUID.fromString("13131313-1313-4313-8313-131313131313");
        UUID femaleUuid = UUID.fromString("14141414-1414-4414-8414-141414141414");
        seedGanadero(otherOwnerId, "NIT-REPRO-GANADERO", "Ganadero Usuario", "ganadero-repro@hato.bo");
        seedUser(otherUserId, "ganadero-repro", "ganadero-repro@hato.bo", Role.GANADERO);
        seedAnimal(femaleUuid, "AR-hembra-admin", AnimalSex.HEMBRA, OWNER_ID);

        BusinessException exception = assertThrows(BusinessException.class, () -> animalReproductionEventService.create(new AnimalReproductionEventRequest(
                femaleUuid,
                AnimalReproductionEventType.SERVICE,
                OffsetDateTime.parse("2026-04-27T10:00:00Z"),
                "Servicio sin propiedad",
                otherUserId,
                "ONLINE",
                UUID.fromString("15151515-1515-4515-8515-151515151515"),
                Map.of("serviceMethod", "INSEMINACION_ARTIFICIAL", "semenReference", "IA-99"),
                OffsetDateTime.parse("2026-04-27T10:01:00Z")), otherUserId));

        assertEquals("ANIMAL_REPRODUCTION_EVENT_OWNER_FORBIDDEN", exception.code());
    }

    @Test
    void shouldCreatePositivePregnancyDiagnosisForFemaleAnimal() {
        UUID femaleUuid = UUID.fromString("16161616-1616-4616-8616-161616161616");
        seedAnimal(femaleUuid, "AR-hembra-prenada", AnimalSex.HEMBRA, OWNER_ID);

        var created = animalReproductionEventService.create(request(
                femaleUuid,
                AnimalReproductionEventType.PREGNANCY_DIAGNOSIS,
                UUID.fromString("17171717-1717-4717-8717-171717171717"),
                "Diagnóstico positivo",
                Map.of(
                        "diagnosisDate", "2026-05-10T10:00:00Z",
                        "result", "PRENADA",
                        "expectedBirthDate", "2027-02-14T00:00:00Z")), USER_ID);

        assertEquals(AnimalReproductionEventType.PREGNANCY_DIAGNOSIS, created.getReproductionEventType());
        assertEquals(femaleUuid, created.getAnimal().getUuid());
    }

    @Test
    void shouldCreatePregnancyDiagnosisLinkedToPriorServiceForSameAnimal() {
        UUID femaleUuid = UUID.fromString("16161616-1616-4616-8616-161616161617");
        seedAnimal(femaleUuid, "AR-hembra-prenada-servicio", AnimalSex.HEMBRA, OWNER_ID);
        var service = animalReproductionEventService.create(request(
                femaleUuid,
                AnimalReproductionEventType.SERVICE,
                UUID.fromString("17171717-1717-4717-8717-171717171710"),
                "Servicio IA",
                Map.of("serviceMethod", "INSEMINACION_ARTIFICIAL", "semenReference", "IA-77")), USER_ID);

        var diagnosis = animalReproductionEventService.create(request(
                femaleUuid,
                AnimalReproductionEventType.PREGNANCY_DIAGNOSIS,
                UUID.fromString("17171717-1717-4717-8717-171717171711"),
                "Diagnóstico asociado",
                Map.of(
                        "diagnosisDate", "2026-05-10T10:00:00Z",
                        "result", "PRENADA",
                        "serviceEventUuid", service.getEventId().toString())), USER_ID);

        assertEquals(AnimalReproductionEventType.PREGNANCY_DIAGNOSIS, diagnosis.getReproductionEventType());
        assertEquals(service.getEventId().toString(),
                animalReproductionEventService.toPullItem(diagnosis).get("metadata") instanceof Map<?, ?> metadata
                        ? metadata.get("serviceEventUuid")
                        : null);
    }

    @Test
    void shouldRejectPregnancyDiagnosisLinkedToServiceFromAnotherAnimal() {
        UUID femaleUuid = UUID.fromString("16161616-1616-4616-8616-161616161618");
        UUID otherFemaleUuid = UUID.fromString("16161616-1616-4616-8616-161616161619");
        seedAnimal(femaleUuid, "AR-hembra-prenada-propia", AnimalSex.HEMBRA, OWNER_ID);
        seedAnimal(otherFemaleUuid, "AR-hembra-prenada-ajena", AnimalSex.HEMBRA, OWNER_ID);
        var otherService = animalReproductionEventService.create(request(
                otherFemaleUuid,
                AnimalReproductionEventType.SERVICE,
                UUID.fromString("17171717-1717-4717-8717-171717171712"),
                "Servicio de otra hembra",
                Map.of("serviceMethod", "INSEMINACION_ARTIFICIAL", "semenReference", "IA-78")), USER_ID);

        BusinessException exception = assertThrows(BusinessException.class, () -> animalReproductionEventService.create(request(
                femaleUuid,
                AnimalReproductionEventType.PREGNANCY_DIAGNOSIS,
                UUID.fromString("17171717-1717-4717-8717-171717171713"),
                "Diagnóstico con servicio ajeno",
                Map.of(
                        "diagnosisDate", "2026-05-10T10:00:00Z",
                        "result", "PRENADA",
                        "serviceEventUuid", otherService.getEventId().toString())), USER_ID));

        assertEquals("ANIMAL_REPRODUCTION_EVENT_SERVICE_REFERENCE_ANIMAL_MISMATCH", exception.code());
    }

    @Test
    void shouldRejectPregnancyDiagnosisLinkedToNonServiceEvent() {
        UUID femaleUuid = UUID.fromString("16161616-1616-4616-8616-161616161620");
        seedAnimal(femaleUuid, "AR-hembra-prenada-tipo", AnimalSex.HEMBRA, OWNER_ID);
        var previousDiagnosis = animalReproductionEventService.create(request(
                femaleUuid,
                AnimalReproductionEventType.PREGNANCY_DIAGNOSIS,
                UUID.fromString("17171717-1717-4717-8717-171717171714"),
                "Diagnóstico previo",
                Map.of(
                        "diagnosisDate", "2026-05-10T10:00:00Z",
                        "result", "PRENADA")), USER_ID);

        BusinessException exception = assertThrows(BusinessException.class, () -> animalReproductionEventService.create(request(
                femaleUuid,
                AnimalReproductionEventType.PREGNANCY_DIAGNOSIS,
                UUID.fromString("17171717-1717-4717-8717-171717171715"),
                "Diagnóstico con tipo inválido",
                Map.of(
                        "diagnosisDate", "2026-05-11T10:00:00Z",
                        "result", "PRENADA",
                        "serviceEventUuid", previousDiagnosis.getEventId().toString())), USER_ID));

        assertEquals("ANIMAL_REPRODUCTION_EVENT_SERVICE_REFERENCE_TYPE_INVALID", exception.code());
    }

    @Test
    void shouldCreateNegativePregnancyDiagnosisWithFailureMetadata() {
        UUID femaleUuid = UUID.fromString("18181818-1818-4818-8818-181818181818");
        seedAnimal(femaleUuid, "AR-hembra-vacia", AnimalSex.HEMBRA, OWNER_ID);

        var created = animalReproductionEventService.create(request(
                femaleUuid,
                AnimalReproductionEventType.PREGNANCY_DIAGNOSIS,
                UUID.fromString("19191919-1919-4919-8919-191919191919"),
                "No preñada",
                Map.of(
                        "diagnosisDate", "2026-05-10T10:00:00Z",
                        "result", "NO_PRENADA",
                        "negativeResult", true,
                        "status", "fallo")), USER_ID);

        assertEquals(AnimalReproductionEventType.PREGNANCY_DIAGNOSIS, created.getReproductionEventType());
        assertEquals(femaleUuid, created.getAnimal().getUuid());
    }

    @Test
    void shouldRejectPregnancyDiagnosisForMaleAnimal() {
        UUID maleUuid = UUID.fromString("20202020-2020-4020-8020-202020202020");
        seedAnimal(maleUuid, "AR-macho-diagnostico", AnimalSex.MACHO, OWNER_ID);

        BusinessException exception = assertThrows(BusinessException.class, () -> animalReproductionEventService.create(request(
                maleUuid,
                AnimalReproductionEventType.PREGNANCY_DIAGNOSIS,
                UUID.fromString("21212121-2121-4121-8121-212121212121"),
                "Diagnóstico inválido",
                Map.of("diagnosisDate", "2026-05-10T10:00:00Z", "result", "NO_PRENADA", "negativeResult", true, "status", "fallo")), USER_ID));

        assertEquals("ANIMAL_REPRODUCTION_EVENT_FEMALE_REQUIRED", exception.code());
    }

    @Test
    void shouldRejectPregnancyDiagnosisWhenGanaderoUserDoesNotOwnAnimal() {
        UUID otherOwnerId = UUID.fromString("22222222-2222-4222-8222-222222222222");
        UUID otherUserId = UUID.fromString("23232323-2323-4323-8323-232323232323");
        UUID femaleUuid = UUID.fromString("24242424-2424-4424-8424-242424242424");
        seedGanadero(otherOwnerId, "NIT-REPRO-DIAG", "Ganadero Diagnóstico", "ganadero-diagnostico@hato.bo");
        seedUser(otherUserId, "ganadero-diagnostico", "ganadero-diagnostico@hato.bo", Role.GANADERO);
        seedAnimal(femaleUuid, "AR-hembra-ajena", AnimalSex.HEMBRA, OWNER_ID);

        BusinessException exception = assertThrows(BusinessException.class, () -> animalReproductionEventService.create(new AnimalReproductionEventRequest(
                femaleUuid,
                AnimalReproductionEventType.PREGNANCY_DIAGNOSIS,
                OffsetDateTime.parse("2026-05-10T10:00:00Z"),
                "Diagnóstico sin propiedad",
                otherUserId,
                "ONLINE",
                UUID.fromString("25252525-2525-4525-8525-252525252525"),
                Map.of("diagnosisDate", "2026-05-10T10:00:00Z", "result", "PRENADA"),
                OffsetDateTime.parse("2026-05-10T10:01:00Z")), otherUserId));

        assertEquals("ANIMAL_REPRODUCTION_EVENT_OWNER_FORBIDDEN", exception.code());
    }

    @Test
    void shouldProjectBirthParentageIntoOffspringAnimals() {
        UUID motherUuid = UUID.fromString("11111111-1111-1111-1111-111111111111");
        UUID fatherUuid = UUID.fromString("22222222-2222-2222-2222-222222222222");
        UUID calfOneUuid = UUID.fromString("33333333-3333-3333-3333-333333333333");
        UUID calfTwoUuid = UUID.fromString("44444444-4444-4444-4444-444444444444");
        seedAnimal(motherUuid, "AR-mother");
        seedAnimal(fatherUuid, "AR-father");
        seedAnimal(calfOneUuid, "AR-calf-1");
        seedAnimal(calfTwoUuid, "AR-calf-2");

        animalReproductionEventService.create(request(
                motherUuid,
                AnimalReproductionEventType.BIRTH,
                UUID.fromString("55555555-5555-5555-5555-555555555555"),
                "Parto doble",
                Map.of(
                        "birthDate", "2026-04-27T10:00:00Z",
                        "offspringCount", 2,
                        "motherAnimalUuid", motherUuid.toString(),
                        "fatherAnimalUuid", fatherUuid.toString(),
                        "offspringAnimalUuids", List.of(calfOneUuid.toString(), calfTwoUuid.toString()))), USER_ID);

        Animal calfOne = QuarkusTransaction.requiringNew().call(() -> animalRepository.findByUuid(calfOneUuid).orElseThrow());
        Animal calfTwo = QuarkusTransaction.requiringNew().call(() -> animalRepository.findByUuid(calfTwoUuid).orElseThrow());

        assertEquals(motherUuid, calfOne.getMotherAnimalUuid());
        assertEquals(fatherUuid, calfOne.getFatherAnimalUuid());
        assertEquals(LocalDate.of(2026, 4, 27), calfOne.getBirthDate());
        assertEquals(motherUuid, calfTwo.getMotherAnimalUuid());
        assertEquals(fatherUuid, calfTwo.getFatherAnimalUuid());
    }

    @Test
    void shouldRejectGanaderoBirthWhenMetadataReferencesOtherOwnerAnimals() {
        UUID ownOwnerId = UUID.fromString("51515151-5151-4151-8151-515151515151");
        UUID otherOwnerId = UUID.fromString("52525252-5252-4252-8252-525252525252");
        UUID ganaderoUserId = UUID.fromString("53535353-5353-4353-8353-535353535353");
        UUID ownMotherUuid = UUID.fromString("54545454-5454-4454-8454-545454545454");
        UUID ownFatherUuid = UUID.fromString("55555555-5555-4555-8555-555555555555");
        UUID ownCalfUuid = UUID.fromString("56565656-5656-4656-8656-565656565656");
        UUID otherMotherUuid = UUID.fromString("57575757-5757-4757-8757-575757575757");
        UUID otherFatherUuid = UUID.fromString("58585858-5858-4858-8858-585858585858");
        UUID otherCalfUuid = UUID.fromString("59595959-5959-4959-8959-595959595959");
        seedGanadero(ownOwnerId, "NIT-BIRTH-OWN", "Ganadero Birth Own", "birth-own@hato.bo");
        seedGanadero(otherOwnerId, "NIT-BIRTH-OTHER", "Ganadero Birth Other", "birth-other@hato.bo");
        seedUser(ganaderoUserId, "birth-own", "birth-own@hato.bo", Role.GANADERO);
        seedAnimal(ownMotherUuid, "AR-birth-own-mother", AnimalSex.HEMBRA, ownOwnerId);
        seedAnimal(ownFatherUuid, "AR-birth-own-father", AnimalSex.MACHO, ownOwnerId);
        seedAnimal(ownCalfUuid, "AR-birth-own-calf", AnimalSex.HEMBRA, ownOwnerId);
        seedAnimal(otherMotherUuid, "AR-birth-other-mother", AnimalSex.HEMBRA, otherOwnerId);
        seedAnimal(otherFatherUuid, "AR-birth-other-father", AnimalSex.MACHO, otherOwnerId);
        seedAnimal(otherCalfUuid, "AR-birth-other-calf", AnimalSex.HEMBRA, otherOwnerId);

        BusinessException motherException = assertThrows(BusinessException.class, () -> animalReproductionEventService.create(birthRequest(
                ownMotherUuid,
                ganaderoUserId,
                UUID.fromString("5a5a5a5a-5a5a-4a5a-8a5a-5a5a5a5a5a5a"),
                Map.of(
                        "birthDate", "2026-04-27T10:00:00Z",
                        "offspringCount", 1,
                        "motherAnimalUuid", otherMotherUuid.toString(),
                        "offspringAnimalUuids", List.of(ownCalfUuid.toString()))), ganaderoUserId));
        BusinessException fatherException = assertThrows(BusinessException.class, () -> animalReproductionEventService.create(birthRequest(
                ownMotherUuid,
                ganaderoUserId,
                UUID.fromString("5b5b5b5b-5b5b-4b5b-8b5b-5b5b5b5b5b5b"),
                Map.of(
                        "birthDate", "2026-04-27T10:00:00Z",
                        "offspringCount", 1,
                        "motherAnimalUuid", ownMotherUuid.toString(),
                        "fatherAnimalUuid", otherFatherUuid.toString(),
                        "offspringAnimalUuids", List.of(ownCalfUuid.toString()))), ganaderoUserId));
        BusinessException offspringException = assertThrows(BusinessException.class, () -> animalReproductionEventService.create(birthRequest(
                ownMotherUuid,
                ganaderoUserId,
                UUID.fromString("5c5c5c5c-5c5c-4c5c-8c5c-5c5c5c5c5c5c"),
                Map.of(
                        "birthDate", "2026-04-27T10:00:00Z",
                        "offspringCount", 1,
                        "motherAnimalUuid", ownMotherUuid.toString(),
                        "fatherAnimalUuid", ownFatherUuid.toString(),
                        "offspringAnimalUuids", List.of(otherCalfUuid.toString()))), ganaderoUserId));

        assertEquals("ANIMAL_REPRODUCTION_EVENT_OWNER_FORBIDDEN", motherException.code());
        assertEquals("ANIMAL_REPRODUCTION_EVENT_OWNER_FORBIDDEN", fatherException.code());
        assertEquals("ANIMAL_REPRODUCTION_EVENT_OWNER_FORBIDDEN", offspringException.code());
        Animal otherCalf = QuarkusTransaction.requiringNew().call(() -> animalRepository.findByUuid(otherCalfUuid).orElseThrow());
        assertEquals(null, otherCalf.getMotherAnimalUuid());
        assertEquals(0, animalEventLogRepository.count("eventCategory", AnimalEventCategory.REPRODUCTION));
    }

    @Test
    void shouldRejectBirthWhenParentageProjectionWouldOverwriteExistingMother() {
        UUID motherUuid = UUID.fromString("11111111-1111-1111-1111-111111111111");
        UUID conflictingMotherUuid = UUID.fromString("99999999-9999-9999-9999-999999999999");
        UUID calfUuid = UUID.fromString("33333333-3333-3333-3333-333333333333");
        seedAnimal(motherUuid, "AR-mother");
        seedAnimal(conflictingMotherUuid, "AR-mother-2");
        seedAnimal(calfUuid, "AR-calf-1");

        QuarkusTransaction.requiringNew().run(() -> {
            Animal calf = animalRepository.findByUuid(calfUuid).orElseThrow();
            calf.setMotherAnimalUuid(conflictingMotherUuid);
        });

        BusinessException exception = assertThrows(BusinessException.class, () -> animalReproductionEventService.create(request(
                motherUuid,
                AnimalReproductionEventType.BIRTH,
                UUID.fromString("55555555-5555-5555-5555-555555555555"),
                "Parto conflictivo",
                Map.of(
                        "birthDate", "2026-04-27T10:00:00Z",
                        "offspringCount", 1,
                        "motherAnimalUuid", motherUuid.toString(),
                        "offspringAnimalUuids", List.of(calfUuid.toString()))), USER_ID));

        assertEquals("ANIMAL_REPRODUCTION_EVENT_PARENTAGE_CONFLICT", exception.code());
    }

    @Test
    void shouldRejectBirthWhenFatherAnimalDoesNotExist() {
        UUID motherUuid = UUID.fromString("11111111-1111-1111-1111-111111111111");
        UUID missingFatherUuid = UUID.fromString("77777777-7777-7777-7777-777777777777");
        UUID calfUuid = UUID.fromString("33333333-3333-3333-3333-333333333333");
        seedAnimal(motherUuid, "AR-mother");
        seedAnimal(calfUuid, "AR-calf-1");

        BusinessException exception = assertThrows(BusinessException.class, () -> animalReproductionEventService.create(request(
                motherUuid,
                AnimalReproductionEventType.BIRTH,
                UUID.fromString("88888888-8888-8888-8888-888888888888"),
                "Parto sin padre persistido",
                Map.of(
                        "birthDate", "2026-04-27T10:00:00Z",
                        "offspringCount", 1,
                        "motherAnimalUuid", motherUuid.toString(),
                        "fatherAnimalUuid", missingFatherUuid.toString(),
                        "offspringAnimalUuids", List.of(calfUuid.toString()))), USER_ID));

        assertEquals("ANIMAL_REPRODUCTION_EVENT_FATHER_NOT_FOUND", exception.code());
    }

    @Test
    void shouldDerivePerformedByUserIdFromAuthenticatedUser() {
        UUID animalUuid = UUID.fromString("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
        UUID authenticatedUserId = UUID.fromString("99999999-aaaa-4bbb-8ccc-dddddddddddd");
        seedUser(authenticatedUserId, "repro-admin-derived", "repro-admin-derived@hato.bo", Role.ADMIN);
        seedAnimal(animalUuid, "AR-derived");

        var created = animalReproductionEventService.create(new AnimalReproductionEventRequest(
                animalUuid,
                AnimalReproductionEventType.SERVICE,
                OffsetDateTime.parse("2026-04-27T20:00:00Z"),
                "Servicio derivado",
                null,
                "OFFLINE",
                UUID.fromString("12121212-3434-4567-8901-121212121212"),
                Map.of("serviceMethod", "NATURAL"),
                OffsetDateTime.parse("2026-04-27T20:01:00Z")), authenticatedUserId);

        assertEquals(authenticatedUserId, created.getPerformedByUserId());
    }

    @Test
    void shouldRejectPerformedByUserMismatchAgainstAuthenticatedUser() {
        UUID animalUuid = UUID.fromString("ffffffff-eeee-4ddd-8ccc-bbbbbbbbbbbb");
        seedAnimal(animalUuid, "AR-mismatch");

        BusinessException exception = assertThrows(BusinessException.class, () -> animalReproductionEventService.create(new AnimalReproductionEventRequest(
                animalUuid,
                AnimalReproductionEventType.SERVICE,
                OffsetDateTime.parse("2026-04-27T21:00:00Z"),
                "Servicio inválido",
                UUID.fromString("abababab-abab-4bab-8bab-abababababab"),
                "OFFLINE",
                UUID.fromString("cdcdcdcd-cdcd-4dcd-8dcd-cdcdcdcdcdcd"),
                Map.of("serviceMethod", "NATURAL"),
                OffsetDateTime.parse("2026-04-27T21:01:00Z")), UUID.fromString("efefefef-efef-4fef-8fef-efefefefefef")));

        assertEquals("ANIMAL_REPRODUCTION_EVENT_PERFORMED_BY_MISMATCH", exception.code());
    }

    private AnimalReproductionEventRequest birthRequest(
            UUID animalUuid,
            UUID performedByUserId,
            UUID operationId,
            Map<String, Object> metadata) {
        return new AnimalReproductionEventRequest(
                animalUuid,
                AnimalReproductionEventType.BIRTH,
                OffsetDateTime.parse("2026-04-27T10:00:00Z"),
                "Parto offline",
                performedByUserId,
                "OFFLINE",
                operationId,
                metadata,
                OffsetDateTime.parse("2026-04-27T10:01:00Z"));
    }

    private AnimalReproductionEventRequest request(
            UUID animalUuid,
            AnimalReproductionEventType type,
            UUID operationId,
            String notes,
            Map<String, Object> metadata) {
        return new AnimalReproductionEventRequest(
                animalUuid,
                type,
                OffsetDateTime.parse("2026-04-27T10:00:00Z"),
                notes,
                USER_ID,
                "OFFLINE",
                operationId,
                metadata,
                OffsetDateTime.parse("2026-04-27T10:01:00Z"));
    }

    private void seedAnimal(UUID animalUuid, String tag) {
        seedAnimal(animalUuid, tag, AnimalSex.HEMBRA, OWNER_ID);
    }

    private void seedAnimal(UUID animalUuid, String tag, AnimalSex sex, UUID ownerId) {
        QuarkusTransaction.requiringNew().run(() -> {
            Animal animal = new Animal();
            animal.setUuid(animalUuid);
            animal.setCode("CODE-" + tag);
            animal.setTag("TAG-" + tag);
            animal.setArete(tag);
            animal.setAreteNormalized(tag.toLowerCase());
            animal.setMarca("Marca " + tag);
            animal.setMarcaNormalized(("Marca " + tag).toLowerCase());
            animal.setOwnerGanadero(ganaderoRepository.findByIdOptional(ownerId).orElseThrow());
            animal.setCategory(sex == AnimalSex.HEMBRA ? AnimalCategory.VACA : AnimalCategory.TORO);
            animal.setSex(sex);
            animal.setActive(true);
            animal.setAdmissionDate(LocalDate.of(2024, 1, 1));
            animal.setWeightKg(new BigDecimal("400.00"));
            animal.setCreatedAt(LocalDateTime.of(2026, 4, 27, 8, 0));
            animal.setUpdatedAt(LocalDateTime.of(2026, 4, 27, 8, 0));
            animal.setVersion(0L);
            animalRepository.persist(animal);
        });
    }

    private Ganadero buildGanadero() {
        return buildGanadero(OWNER_ID, "NIT-REPRO-001", "Ganadero Repro");
    }

    private void seedGanadero(UUID id, String businessIdentifier, String name) {
        seedGanadero(id, businessIdentifier, name, null);
    }

    private void seedGanadero(UUID id, String businessIdentifier, String name, String email) {
        QuarkusTransaction.requiringNew().run(() -> ganaderoRepository.persist(buildGanadero(id, businessIdentifier, name, email)));
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

    private void seedUser(UUID id, String username, String email, Role role) {
        QuarkusTransaction.requiringNew().run(() -> {
            User user = new User();
            user.setId(id);
            user.setUsername(username);
            user.setEmail(email);
            user.setDisplayName(username);
            user.setPasswordHash("hash");
            user.setRole(role);
            user.setStatus(UserStatus.ACTIVE);
            userRepository.persist(user);
        });
    }
}

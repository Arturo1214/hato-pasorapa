package bo.pasorapa.hato.service.mapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.AnimalEventLog;
import bo.pasorapa.hato.service.model.AnimalReproductionEvent;
import bo.pasorapa.hato.domain.enumeration.AnimalEventCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalReproductionEventType;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AnimalReproductionEventMapperTest {

    private final AnimalReproductionEventMapper mapper = new AnimalReproductionEventMapper(new ObjectMapper());

    @Test
    void shouldMapReproductionEntityToUnifiedLogWithAllowedTypesAndMetadataPreserved() {
        for (AnimalReproductionEventType type : new AnimalReproductionEventType[] {
                AnimalReproductionEventType.SERVICE,
                AnimalReproductionEventType.PREGNANCY_CONFIRMED,
                AnimalReproductionEventType.PREGNANCY_LOSS,
                AnimalReproductionEventType.BIRTH}) {
            AnimalReproductionEvent event = reproductionEvent(type);

            AnimalEventLog log = mapper.toAnimalEventLog(event);

            assertEquals(AnimalEventCategory.REPRODUCTION, log.getEventCategory());
            assertEquals(type.name(), log.getEventType());
            assertEquals(mapper.readMetadataJson(event.getMetadataJson()), mapper.readMetadataJson(log.getMetadataJson()));
        }
    }

    @Test
    void shouldRejectCrossCategoryTypeForReproductionLog() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> mapper.validateReproductionEventType("SOLD"));

        assertEquals("ANIMAL_EVENT_LOG_REPRODUCTION_TYPE_INVALID", exception.getMessage());
    }

    @Test
    void shouldMapReproductionRequestToUnifiedLogWithReproductionCategory() {
        UUID animalUuid = UUID.fromString("55555555-5555-4555-8555-555555555555");
        Animal animal = new Animal();
        animal.setUuid(animalUuid);
        var request = mapper.toRequest(
                Map.of(
                        "animalUuid", animalUuid.toString(),
                        "reproductionEventType", "SERVICE",
                        "occurredAt", "2026-05-10T08:00:00Z",
                        "performedByUserId", "66666666-6666-4666-8666-666666666666",
                        "sourceChannel", "OFFLINE",
                        "operationId", "77777777-7777-4777-8777-777777777777",
                        "metadata", Map.of("serviceMethod", "INSEMINACION_ARTIFICIAL")),
                OffsetDateTime.parse("2026-05-10T08:01:00Z"));

        AnimalEventLog log = mapper.toAnimalEventLog(animal, request, request.performedByUserId());

        assertEquals(AnimalEventCategory.REPRODUCTION, log.getEventCategory());
        assertEquals("SERVICE", log.getEventType());
        assertEquals("INSEMINACION_ARTIFICIAL", mapper.readMetadataJson(log.getMetadataJson()).get("serviceMethod"));
    }

    @Test
    void shouldMapUnifiedReproductionLogBackToResponsePreservingMetadataSchema() {
        UUID animalUuid = UUID.fromString("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
        Animal animal = new Animal();
        animal.setUuid(animalUuid);
        AnimalEventLog log = new AnimalEventLog();
        log.setEventId(UUID.fromString("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"));
        log.setAnimal(animal);
        log.setEventCategory(AnimalEventCategory.REPRODUCTION);
        log.setEventType("BIRTH");
        log.setOccurredAt(LocalDateTime.parse("2026-05-10T08:00:00"));
        log.setClientCreatedAt(LocalDateTime.parse("2026-05-10T08:01:00"));
        log.setNotes("Parto desde log");
        log.setPerformedByUserId(UUID.fromString("cccccccc-cccc-4ccc-8ccc-cccccccccccc"));
        log.setSourceChannel("OFFLINE");
        log.setOperationId(UUID.fromString("dddddddd-dddd-4ddd-8ddd-dddddddddddd"));
        log.setMetadataJson(mapper.writeMetadataJson(Map.of(
                "birthDate", "2026-05-10T08:00:00Z",
                "offspringCount", 1,
                "motherAnimalUuid", animalUuid.toString(),
                "offspringAnimalUuids", java.util.List.of("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"))));
        log.setCreatedAt(LocalDateTime.parse("2026-05-10T08:02:00"));
        log.setUpdatedAt(LocalDateTime.parse("2026-05-10T08:03:00"));

        var response = mapper.toAnimalReproductionEventDto(log);

        assertEquals(AnimalReproductionEventType.BIRTH, response.reproductionEventType());
        assertEquals(1, response.metadata().get("offspringCount"));
        assertEquals(java.util.List.of("eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee"), response.metadata().get("offspringAnimalUuids"));
        assertEquals(OffsetDateTime.parse("2026-05-10T08:03:00Z"), response.updatedAt());
    }

    @Test
    void shouldMapServicePayloadWithTypedMetadata() {
        var request = mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "reproductionEventType", "SERVICE",
                        "occurredAt", "2026-04-27T10:00:00Z",
                        "notes", "Servicio natural",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "offline",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", Map.of("serviceMethod", "NATURAL")),
                OffsetDateTime.parse("2026-04-27T10:05:00Z"));

        assertEquals(UUID.fromString("d249f65d-af66-4488-9e78-7a5996b8f1ea"), request.animalUuid());
        assertEquals("OFFLINE", request.sourceChannel());
        assertEquals("NATURAL", request.metadata().get("serviceMethod"));
    }

    @Test
    void shouldAllowPregnancyConfirmedWhenConfirmationDateIsPresent() {
        var request = mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "reproductionEventType", "PREGNANCY_CONFIRMED",
                        "occurredAt", "2026-04-27T10:00:00Z",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "OFFLINE",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", Map.of("confirmationDate", "2026-04-27T10:00:00Z")),
                OffsetDateTime.parse("2026-04-27T10:05:00Z"));

        assertEquals("PREGNANCY_CONFIRMED", request.reproductionEventType().name());
    }

    @Test
    void shouldAllowPregnancyDiagnosisWithPositiveResultAndExpectedBirthDate() {
        var request = mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "reproductionEventType", "PREGNANCY_DIAGNOSIS",
                        "occurredAt", "2026-05-10T10:00:00Z",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "OFFLINE",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", Map.of(
                                "diagnosisDate", "2026-05-10T10:00:00Z",
                                "result", "PRENADA",
                                "expectedBirthDate", "2027-02-14T00:00:00Z",
                                "serviceEventUuid", "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")),
                OffsetDateTime.parse("2026-05-10T10:05:00Z"));

        assertEquals("PREGNANCY_DIAGNOSIS", request.reproductionEventType().name());
        assertEquals("PRENADA", request.metadata().get("result"));
        assertEquals("aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee", request.metadata().get("serviceEventUuid"));
    }

    @Test
    void shouldRejectPregnancyDiagnosisWithoutValidResult() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "reproductionEventType", "PREGNANCY_DIAGNOSIS",
                        "occurredAt", "2026-05-10T10:00:00Z",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "OFFLINE",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", Map.of("diagnosisDate", "2026-05-10T10:00:00Z", "result", "DUDOSA")),
                OffsetDateTime.parse("2026-05-10T10:05:00Z")));

        assertEquals("ANIMAL_REPRODUCTION_EVENT_DIAGNOSIS_RESULT_INVALID", exception.getMessage());
    }

    @Test
    void shouldRejectBirthsWithoutOffspringCount() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "reproductionEventType", "BIRTH",
                        "occurredAt", "2026-04-27T10:00:00Z",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "OFFLINE",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", Map.of(
                                "birthDate", "2026-04-27T10:00:00Z",
                                "motherAnimalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea")),
                OffsetDateTime.parse("2026-04-27T10:05:00Z")));

        assertEquals("ANIMAL_REPRODUCTION_EVENT_OFFSPRING_COUNT_REQUIRED", exception.getMessage());
    }

    @Test
    void shouldRequireBirthOffspringAnimalUuidsWhenOffspringCountIsPositive() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "reproductionEventType", "BIRTH",
                        "occurredAt", "2026-04-27T10:00:00Z",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "OFFLINE",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", Map.of(
                                "birthDate", "2026-04-27T10:00:00Z",
                                "offspringCount", 1,
                                "motherAnimalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea")),
                OffsetDateTime.parse("2026-04-27T10:05:00Z")));

        assertEquals("ANIMAL_REPRODUCTION_EVENT_OFFSPRING_ANIMAL_UUIDS_REQUIRED", exception.getMessage());
    }

    @Test
    void shouldRejectBirthsWithoutMotherAnimalUuid() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "reproductionEventType", "BIRTH",
                        "occurredAt", "2026-04-27T10:00:00Z",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "OFFLINE",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", Map.of(
                                "birthDate", "2026-04-27T10:00:00Z",
                                "offspringCount", 0)),
                OffsetDateTime.parse("2026-04-27T10:05:00Z")));

        assertEquals("ANIMAL_REPRODUCTION_EVENT_MOTHER_ANIMAL_UUID_REQUIRED", exception.getMessage());
    }

    @Test
    void shouldRejectOutOfScopeFields() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "reproductionEventType", "SERVICE",
                        "occurredAt", "2026-04-27T10:00:00Z",
                        "performedByUserId", "85a0b2bb-f2d8-42ab-b215-178bb30f0276",
                        "sourceChannel", "OFFLINE",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "metadata", Map.of("serviceMethod", "NATURAL", "geneticPanel", "OUT")),
                OffsetDateTime.parse("2026-04-27T10:05:00Z")));

        assertEquals("ANIMAL_REPRODUCTION_EVENT_OUT_OF_SCOPE_FIELD", exception.getMessage());
    }

    private AnimalReproductionEvent reproductionEvent(AnimalReproductionEventType type) {
        Animal animal = new Animal();
        animal.setUuid(UUID.fromString("11111111-1111-4111-8111-111111111111"));
        AnimalReproductionEvent event = new AnimalReproductionEvent();
        event.setEventId(UUID.randomUUID());
        event.setAnimal(animal);
        event.setReproductionEventType(type);
        event.setOccurredAt(LocalDateTime.parse("2026-05-10T08:00:00"));
        event.setClientCreatedAt(LocalDateTime.parse("2026-05-10T08:01:00"));
        event.setNotes("Notas " + type);
        event.setPerformedByUserId(UUID.fromString("33333333-3333-4333-8333-333333333333"));
        event.setSourceChannel("OFFLINE");
        event.setOperationId(UUID.randomUUID());
        event.setMetadataJson(mapper.writeMetadataJson(metadataFor(type)));
        event.setCreatedAt(LocalDateTime.parse("2026-05-10T08:02:00"));
        event.setUpdatedAt(LocalDateTime.parse("2026-05-10T08:03:00"));
        return event;
    }

    private Map<String, Object> metadataFor(AnimalReproductionEventType type) {
        return switch (type) {
            case SERVICE -> Map.of("serviceMethod", "INSEMINACION_ARTIFICIAL");
            case PREGNANCY_DIAGNOSIS -> Map.of("diagnosisDate", "2026-05-10T08:00:00Z", "result", "PRENADA");
            case PREGNANCY_CONFIRMED -> Map.of("confirmationDate", "2026-05-10T08:00:00Z");
            case PREGNANCY_LOSS -> Map.of("lossReason", "REABSORCION");
            case BIRTH -> Map.of(
                    "birthDate", "2026-05-10T08:00:00Z",
                    "offspringCount", 0,
                    "motherAnimalUuid", "11111111-1111-4111-8111-111111111111");
        };
    }
}

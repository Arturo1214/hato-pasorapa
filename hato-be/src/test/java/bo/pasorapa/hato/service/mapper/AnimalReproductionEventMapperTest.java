package bo.pasorapa.hato.service.mapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AnimalReproductionEventMapperTest {

    private final AnimalReproductionEventMapper mapper = new AnimalReproductionEventMapper(new ObjectMapper());

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
}

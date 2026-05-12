package bo.pasorapa.hato.service.mapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.AnimalEvent;
import bo.pasorapa.hato.domain.AnimalEventLog;
import bo.pasorapa.hato.domain.enumeration.AnimalEventCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalEventType;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AnimalEventMapperTest {

    private final AnimalEventMapper mapper = new AnimalEventMapper(new ObjectMapper());

    @Test
    void shouldMapGeneralEntityToUnifiedLogWithAllowedTypesAndMetadataPreserved() {
        for (AnimalEventType type : new AnimalEventType[] {
                AnimalEventType.SOLD,
                AnimalEventType.DECEASED,
                AnimalEventType.LOST,
                AnimalEventType.TRANSFERRED,
                AnimalEventType.OBSERVATION}) {
            AnimalEvent event = generalEvent(type);

            AnimalEventLog log = mapper.toAnimalEventLog(event);

            assertEquals(AnimalEventCategory.GENERAL, log.getEventCategory());
            assertEquals(type.name(), log.getEventType());
            assertEquals(mapper.readMetadataJson(event.getMetadataJson()), mapper.readMetadataJson(log.getMetadataJson()));
        }
    }

    @Test
    void shouldRejectCrossCategoryTypeForGeneralLog() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> mapper.validateGeneralEventType("VACCINATION"));

        assertEquals("ANIMAL_EVENT_LOG_GENERAL_TYPE_INVALID", exception.getMessage());
    }

    @Test
    void shouldMapGeneralRequestToUnifiedLogWithGeneralCategory() {
        UUID animalUuid = UUID.fromString("55555555-5555-4555-8555-555555555555");
        Animal animal = new Animal();
        animal.setUuid(animalUuid);
        var request = mapper.toRequest(
                Map.of(
                        "animalUuid", animalUuid.toString(),
                        "type", "TRANSFERRED",
                        "occurredAt", "2026-05-10T08:00:00Z",
                        "performedByUserId", "66666666-6666-4666-8666-666666666666",
                        "sourceChannel", "OFFLINE",
                        "operationId", "77777777-7777-4777-8777-777777777777",
                        "metadata", Map.of(
                                "fromOwnerGanaderoId", "88888888-8888-4888-8888-888888888888",
                                "toOwnerGanaderoId", "99999999-9999-4999-8999-999999999999")),
                OffsetDateTime.parse("2026-05-10T08:01:00Z"));

        AnimalEventLog log = mapper.toAnimalEventLog(animal, request, request.performedByUserId());

        assertEquals(AnimalEventCategory.GENERAL, log.getEventCategory());
        assertEquals("TRANSFERRED", log.getEventType());
        assertEquals("99999999-9999-4999-8999-999999999999", mapper.readMetadataJson(log.getMetadataJson()).get("toOwnerGanaderoId"));
    }

    @Test
    void shouldMapUnifiedGeneralLogBackToGeneralResponseWithAuditFields() {
        UUID animalUuid = UUID.fromString("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
        UUID performedBy = UUID.fromString("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
        UUID operationId = UUID.fromString("cccccccc-cccc-4ccc-8ccc-cccccccccccc");
        Animal animal = new Animal();
        animal.setUuid(animalUuid);
        AnimalEventLog log = new AnimalEventLog();
        log.setEventId(UUID.fromString("dddddddd-dddd-4ddd-8ddd-dddddddddddd"));
        log.setAnimal(animal);
        log.setEventCategory(AnimalEventCategory.GENERAL);
        log.setEventType("SOLD");
        log.setOccurredAt(LocalDateTime.parse("2026-05-10T08:00:00"));
        log.setClientCreatedAt(LocalDateTime.parse("2026-05-10T08:01:00"));
        log.setNotes("Venta desde log");
        log.setPerformedByUserId(performedBy);
        log.setSourceChannel("OFFLINE");
        log.setOperationId(operationId);
        log.setMetadataJson(mapper.writeMetadataJson(Map.of("reasonCode", "SALE")));
        log.setCreatedAt(LocalDateTime.parse("2026-05-10T08:02:00"));
        log.setUpdatedAt(LocalDateTime.parse("2026-05-10T08:03:00"));

        var response = mapper.toAnimalEventDto(log);

        assertEquals(log.getEventId(), response.id());
        assertEquals(animalUuid, response.animalUuid());
        assertEquals(AnimalEventType.SOLD, response.type());
        assertEquals(performedBy, response.performedByUserId());
        assertEquals(operationId, response.operationId());
        assertEquals("OFFLINE", response.sourceChannel());
        assertEquals("SALE", response.metadata().get("reasonCode"));
        assertEquals(OffsetDateTime.parse("2026-05-10T08:03:00Z"), response.updatedAt());
    }

    private AnimalEvent generalEvent(AnimalEventType type) {
        Animal animal = new Animal();
        animal.setUuid(UUID.fromString("11111111-1111-4111-8111-111111111111"));
        AnimalEvent event = new AnimalEvent();
        event.setEventId(UUID.randomUUID());
        event.setAnimal(animal);
        event.setType(type);
        event.setOccurredAt(LocalDateTime.parse("2026-05-10T08:00:00"));
        event.setClientCreatedAt(LocalDateTime.parse("2026-05-10T08:01:00"));
        event.setNotes("Notas " + type);
        event.setPerformedByUserId(UUID.fromString("33333333-3333-4333-8333-333333333333"));
        event.setSourceChannel("OFFLINE");
        event.setOperationId(UUID.randomUUID());
        event.setMetadataJson(mapper.writeMetadataJson(Map.of("reasonCode", type.name())));
        event.setCreatedAt(LocalDateTime.parse("2026-05-10T08:02:00"));
        event.setUpdatedAt(LocalDateTime.parse("2026-05-10T08:03:00"));
        return event;
    }
}

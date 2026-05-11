package bo.pasorapa.hato.service.mapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.service.dto.sync.SyncEntityType;
import bo.pasorapa.hato.service.dto.sync.SyncOperationType;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SyncPayloadMapperTest {

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final SyncPayloadMapper mapper = new SyncPayloadMapper(
            new AnimalEventMapper(objectMapper),
            new AnimalHealthEventMapper(objectMapper),
            new AnimalReproductionEventMapper(objectMapper),
            new AnimalImageMapper());

    @Test
    void shouldPublishAnimalUpdatePolicyAsSourceOfTruth() {
        var policy = mapper.resolveConflictPolicy(SyncEntityType.ANIMAL, SyncOperationType.UPDATE);

        assertEquals("offline-conflict-resolution/v2/ANIMAL/UPDATE", policy.policyKey());
        assertIterableEquals(java.util.List.of("accept_server", "retry_local", "discard_local"), policy.allowedActions());
        assertEquals("v2", policy.policyVersion());
    }

    @Test
    void shouldExcludeRetryLocalForAnimalImageCreateInV2() {
        var policy = mapper.resolveConflictPolicy(SyncEntityType.ANIMAL_IMAGE, SyncOperationType.CREATE);

        assertIterableEquals(java.util.List.of("discard_local"), policy.allowedActions());
        assertEquals("offline-conflict-resolution/v2/ANIMAL_IMAGE/CREATE", policy.policyKey());
    }

    @Test
    void shouldReturnNullWhenNoManualResolutionPolicyExists() {
        assertNull(mapper.resolveConflictPolicy(SyncEntityType.NOTIFICATION, SyncOperationType.CREATE));
    }

    @Test
    void shouldMapAnimalCharacteristicsFromOfflinePayload() {
        UUID ownerGanaderoId = UUID.fromString("95315ab0-0f7c-4b94-a55e-912d179a702c");
        UUID breedUuid = UUID.fromString("00000000-0000-4000-8000-000000000001");
        Map<String, Object> payload = baseAnimalPayload(ownerGanaderoId);
        payload.put("color", "Colorado");
        payload.put("description", "Bueno para carne");
        payload.put("breedUuid", breedUuid.toString());

        var request = mapper.toAnimalRequest(payload);

        assertEquals(ownerGanaderoId, request.ownerGanaderoId());
        assertEquals(AnimalCategory.VACA, request.category());
        assertEquals(AnimalSex.HEMBRA, request.sex());
        assertEquals(new BigDecimal("410.50"), request.weightKg());
        assertEquals(LocalDate.of(2024, 2, 1), request.admissionDate());
        assertEquals("Colorado", request.color());
        assertEquals("Bueno para carne", request.description());
        assertEquals(breedUuid, request.breedUuid());
    }

    @Test
    void shouldAllowOfflineAnimalPayloadWithoutBreedForLegacyAnimals() {
        UUID ownerGanaderoId = UUID.fromString("95315ab0-0f7c-4b94-a55e-912d179a702c");
        Map<String, Object> payload = baseAnimalPayload(ownerGanaderoId);
        payload.put("color", "");
        payload.put("description", null);

        var request = mapper.toAnimalRequest(payload);

        assertEquals(ownerGanaderoId, request.ownerGanaderoId());
        assertNull(request.color());
        assertNull(request.description());
        assertNull(request.breedUuid());
    }

    private Map<String, Object> baseAnimalPayload(UUID ownerGanaderoId) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("ownerGanaderoId", ownerGanaderoId.toString());
        payload.put("arete", "BO-1000");
        payload.put("category", "VACA");
        payload.put("sex", "HEMBRA");
        payload.put("active", true);
        payload.put("admissionDate", "2024-02-01");
        payload.put("weightKg", "410.50");
        return payload;
    }
}

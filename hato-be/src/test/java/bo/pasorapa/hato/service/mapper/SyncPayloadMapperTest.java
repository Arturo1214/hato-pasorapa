package bo.pasorapa.hato.service.mapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import bo.pasorapa.hato.service.dto.sync.SyncEntityType;
import bo.pasorapa.hato.service.dto.sync.SyncOperationType;
import com.fasterxml.jackson.databind.ObjectMapper;
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
}

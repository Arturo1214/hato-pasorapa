package bo.pasorapa.hato.service.mapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertIterableEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import bo.pasorapa.hato.service.dto.sync.SyncEntityType;
import bo.pasorapa.hato.service.dto.sync.SyncOperationType;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SyncPayloadMapperV2ContractTest {

    private final SyncPayloadMapper mapper = new SyncPayloadMapper(
            new AnimalEventMapper(new ObjectMapper()),
            new AnimalHealthEventMapper(new ObjectMapper()),
            new AnimalReproductionEventMapper(new ObjectMapper()),
            new AnimalImageMapper());

    @Test
    void shouldAcceptMonthlyPeriodKeySingleCurrencyAndDeclaredV2Policies() {
        var productivity = mapper.toHerdProductivityLedgerPayload(Map.of(
                "animalUuid", UUID.randomUUID().toString(),
                "lotId", UUID.randomUUID().toString(),
                "periodKey", "2026-04",
                "metricType", "MILK_LITERS",
                "value", 120));
        var cost = mapper.toHerdCostLedgerPayload(Map.of(
                "lotId", UUID.randomUUID().toString(),
                "periodKey", "2026-04",
                "category", "FEED",
                "source", "PURCHASE",
                "amount", 80,
                "currency", "BOB"));
        var policy = mapper.resolveConflictPolicy(SyncEntityType.COST_LEDGER, SyncOperationType.UPDATE);

        assertEquals("2026-04", productivity.periodKey());
        assertEquals("BOB", cost.currency());
        assertEquals("offline-conflict-resolution/v2/COST_LEDGER/UPDATE", policy.policyKey());
        assertIterableEquals(java.util.List.of("accept_server", "retry_local", "discard_local"), policy.allowedActions());
    }

    @Test
    void shouldRejectInvalidV2ContractsEarly() {
        assertThrows(IllegalArgumentException.class, () -> mapper.toHerdCostLedgerPayload(Map.of(
                "lotId", UUID.randomUUID().toString(),
                "periodKey", "2026/04",
                "category", "FEED",
                "source", "PURCHASE",
                "amount", 80,
                "currency", "BOB")));

        assertThrows(IllegalArgumentException.class, () -> mapper.toHerdCostLedgerPayload(Map.of(
                "lotId", UUID.randomUUID().toString(),
                "periodKey", "2026-04",
                "source", "PURCHASE",
                "amount", -1,
                "currency", "BOB")));

        assertThrows(IllegalArgumentException.class, () -> mapper.toHerdLotAssignmentPayload(Map.of(
                "animalUuid", UUID.randomUUID().toString(),
                "lotId", UUID.randomUUID().toString(),
                "fromDate", "2026-04-10",
                "toDate", "2026-04-01")));
    }
}

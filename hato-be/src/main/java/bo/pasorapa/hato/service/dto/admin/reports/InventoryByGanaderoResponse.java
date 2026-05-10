package bo.pasorapa.hato.service.dto.admin.reports;

import java.util.List;
import java.util.Map;
import java.util.UUID;

public record InventoryByGanaderoResponse(List<InventoryRow> rows) {
    public record InventoryRow(
            UUID ganaderoId,
            String ganaderoName,
            long total,
            long active,
            long inactive,
            Map<String, Long> byCategory,
            Map<String, Long> bySex) {}
}

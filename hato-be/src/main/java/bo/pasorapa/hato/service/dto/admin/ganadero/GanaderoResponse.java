package bo.pasorapa.hato.service.dto.admin.ganadero;

public record GanaderoResponse(
        String id,
        String businessIdentifier,
        String name,
        boolean active,
        long version,
        String createdAt,
        String updatedAt,
        String lastSyncedAt
) {
}

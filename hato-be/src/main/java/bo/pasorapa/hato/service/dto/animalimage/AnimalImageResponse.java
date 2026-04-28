package bo.pasorapa.hato.service.dto.animalimage;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AnimalImageResponse(
        UUID id,
        UUID animalUuid,
        UUID operationId,
        String fileName,
        String mimeType,
        long sizeBytes,
        String checksumSha256,
        String thumbnailRef,
        OffsetDateTime capturedAt,
        String sourceChannel,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {}

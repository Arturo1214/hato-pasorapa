package bo.pasorapa.hato.service.dto.animalimage;

import java.time.OffsetDateTime;
import java.util.UUID;

public record AnimalImageRequest(
        UUID animalUuid,
        UUID operationId,
        String mimeType,
        String fileName,
        long sizeBytes,
        String checksumSha256,
        String base64Data,
        OffsetDateTime capturedAt,
        String sourceChannel) {}

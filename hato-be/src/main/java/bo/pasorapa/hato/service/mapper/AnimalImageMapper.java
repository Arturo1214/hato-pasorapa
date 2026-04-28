package bo.pasorapa.hato.service.mapper;

import static bo.pasorapa.hato.service.mapper.AnimalImageSecuritySupport.DEFAULT_ALLOWLIST;

import bo.pasorapa.hato.domain.AnimalImage;
import bo.pasorapa.hato.service.dto.animalimage.AnimalImageRequest;
import bo.pasorapa.hato.service.dto.animalimage.AnimalImageResponse;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Base64;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;

@ApplicationScoped
public class AnimalImageMapper {

    private static final Set<String> OUT_OF_SCOPE_FIELDS = Set.of("crop", "filters", "video", "audio", "galleryLayout", "webpVariant");

    public AnimalImageRequest toRequest(Map<String, Object> payload, OffsetDateTime clientCreatedAt) {
        UUID animalUuid = requireUuid(payload.get("animalUuid"), "ANIMAL_IMAGE_ANIMAL_UUID_REQUIRED");
        UUID operationId = requireUuid(payload.get("operationId"), "ANIMAL_IMAGE_OPERATION_ID_REQUIRED");
        String mimeType = requireText(payload.get("mimeType"), "ANIMAL_IMAGE_MIME_TYPE_REQUIRED");
        String fileName = requireText(payload.get("fileName"), "ANIMAL_IMAGE_FILE_NAME_REQUIRED");
        long sizeBytes = requireLong(payload.get("sizeBytes"), "ANIMAL_IMAGE_SIZE_BYTES_REQUIRED");
        String checksumSha256 = requireText(payload.get("checksumSha256"), "ANIMAL_IMAGE_CHECKSUM_REQUIRED");
        String base64Data = requireText(payload.get("base64Data"), "ANIMAL_IMAGE_BASE64_DATA_REQUIRED");
        OffsetDateTime capturedAt = requireOffsetDateTime(payload.get("capturedAt"), "ANIMAL_IMAGE_CAPTURED_AT_REQUIRED");
        String sourceChannel = requireText(payload.get("sourceChannel"), "ANIMAL_IMAGE_SOURCE_CHANNEL_REQUIRED");

        validateNoOutOfScopeFields(payload);
        validateMime(mimeType);
        validateFileName(fileName);
        validateSize(sizeBytes);
        validateChecksumFormat(checksumSha256);

        byte[] content = decodeBase64(base64Data);
        if (content.length != sizeBytes) {
            throw new IllegalArgumentException("ANIMAL_IMAGE_SIZE_BYTES_MISMATCH");
        }

        String effectiveChecksum = AnimalImageSecuritySupport.sha256Hex(content);
        if (!effectiveChecksum.equals(AnimalImageSecuritySupport.normalizeChecksum(checksumSha256))) {
            throw new IllegalArgumentException("ANIMAL_IMAGE_CHECKSUM_MISMATCH");
        }

        String normalizedSourceChannel = sourceChannel.trim().toUpperCase(Locale.ROOT);
        if (!"ONLINE".equals(normalizedSourceChannel) && !"OFFLINE".equals(normalizedSourceChannel)) {
            throw new IllegalArgumentException("ANIMAL_IMAGE_SOURCE_CHANNEL_INVALID");
        }

        return new AnimalImageRequest(
                animalUuid,
                operationId,
                AnimalImageSecuritySupport.normalizeMime(mimeType),
                AnimalImageSecuritySupport.sanitizeFileName(fileName),
                sizeBytes,
                AnimalImageSecuritySupport.normalizeChecksum(checksumSha256),
                base64Data,
                capturedAt,
                normalizedSourceChannel);
    }

    public AnimalImageResponse toResponse(AnimalImage image) {
        return new AnimalImageResponse(
                image.getImageId(),
                image.getAnimal().getUuid(),
                image.getOperationId(),
                image.getFileName(),
                image.getMimeType(),
                image.getSizeBytes(),
                image.getChecksumSha256(),
                image.getThumbnailRef(),
                image.getCapturedAt().atOffset(ZoneOffset.UTC),
                image.getSourceChannel(),
                image.getCreatedAt().atOffset(ZoneOffset.UTC),
                image.getUpdatedAt().atOffset(ZoneOffset.UTC));
    }

    public Map<String, Object> toPullItem(AnimalImage image) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", image.getImageId().toString());
        item.put("animalUuid", image.getAnimal().getUuid().toString());
        item.put("operationId", image.getOperationId().toString());
        item.put("fileName", image.getFileName());
        item.put("mimeType", image.getMimeType());
        item.put("sizeBytes", image.getSizeBytes());
        item.put("checksumSha256", image.getChecksumSha256());
        item.put("thumbnailRef", image.getThumbnailRef());
        item.put("capturedAt", image.getCapturedAt().atOffset(ZoneOffset.UTC));
        item.put("sourceChannel", image.getSourceChannel());
        item.put("createdAt", image.getCreatedAt().atOffset(ZoneOffset.UTC));
        item.put("updatedAt", image.getUpdatedAt().atOffset(ZoneOffset.UTC));
        return item;
    }

    public byte[] decodeBase64(String base64Data) {
        try {
            return Base64.getDecoder().decode(base64Data);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("ANIMAL_IMAGE_BASE64_DATA_INVALID");
        }
    }

    private void validateMime(String mimeType) {
        if (!AnimalImageSecuritySupport.isAllowedMime(mimeType, DEFAULT_ALLOWLIST)) {
            throw new IllegalArgumentException("ANIMAL_IMAGE_MIME_TYPE_NOT_ALLOWED");
        }
    }

    private void validateFileName(String fileName) {
        String sanitized = AnimalImageSecuritySupport.sanitizeFileName(fileName);
        if (sanitized == null || sanitized.isBlank()) {
            throw new IllegalArgumentException("ANIMAL_IMAGE_FILE_NAME_REQUIRED");
        }
        if (!sanitized.equals(fileName.trim()) || sanitized.contains("..")) {
            throw new IllegalArgumentException("ANIMAL_IMAGE_FILE_NAME_INVALID");
        }
    }

    private void validateSize(long sizeBytes) {
        if (sizeBytes <= 0L) {
            throw new IllegalArgumentException("ANIMAL_IMAGE_SIZE_BYTES_REQUIRED");
        }
        if (sizeBytes > AnimalImageSecuritySupport.V1_MAX_BYTES) {
            throw new IllegalArgumentException("ANIMAL_IMAGE_SIZE_BYTES_EXCEEDED");
        }
    }

    private void validateChecksumFormat(String checksumSha256) {
        String normalized = AnimalImageSecuritySupport.normalizeChecksum(checksumSha256);
        if (normalized == null || !normalized.matches("[a-f0-9]{64}")) {
            throw new IllegalArgumentException("ANIMAL_IMAGE_CHECKSUM_INVALID");
        }
    }

    private void validateNoOutOfScopeFields(Map<String, Object> payload) {
        if (OUT_OF_SCOPE_FIELDS.stream().anyMatch(payload::containsKey)) {
            throw new IllegalArgumentException("ANIMAL_IMAGE_OUT_OF_SCOPE_FIELD");
        }
    }

    private UUID requireUuid(Object value, String errorCode) {
        if (!(value instanceof String text) || text.isBlank()) {
            throw new IllegalArgumentException(errorCode);
        }
        try {
            return UUID.fromString(text.trim());
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException(errorCode);
        }
    }

    private String requireText(Object value, String errorCode) {
        if (!(value instanceof String text) || text.isBlank()) {
            throw new IllegalArgumentException(errorCode);
        }
        return text.trim();
    }

    private long requireLong(Object value, String errorCode) {
        if (value instanceof Number number) {
            return number.longValue();
        }
        if (value instanceof String text && !text.isBlank()) {
            try {
                return Long.parseLong(text.trim());
            } catch (NumberFormatException exception) {
                throw new IllegalArgumentException(errorCode);
            }
        }
        throw new IllegalArgumentException(errorCode);
    }

    private OffsetDateTime requireOffsetDateTime(Object value, String errorCode) {
        if (!(value instanceof String text) || text.isBlank()) {
            throw new IllegalArgumentException(errorCode);
        }
        try {
            return OffsetDateTime.parse(text.trim());
        } catch (Exception exception) {
            throw new IllegalArgumentException(errorCode);
        }
    }
}

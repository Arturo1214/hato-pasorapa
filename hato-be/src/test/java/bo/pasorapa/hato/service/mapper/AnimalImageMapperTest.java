package bo.pasorapa.hato.service.mapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AnimalImageMapperTest {

    private final AnimalImageMapper mapper = new AnimalImageMapper();

    @Test
    void shouldMapValidAnimalImagePayload() {
        byte[] content = "hola".getBytes();

        var request = mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "mimeType", "image/jpeg",
                        "fileName", "vaca.jpg",
                        "sizeBytes", content.length,
                        "checksumSha256", AnimalImageSecuritySupport.sha256Hex(content),
                        "base64Data", Base64.getEncoder().encodeToString(content),
                        "capturedAt", "2026-04-27T10:00:00Z",
                        "sourceChannel", "offline"),
                OffsetDateTime.parse("2026-04-27T10:05:00Z"));

        assertEquals(UUID.fromString("d249f65d-af66-4488-9e78-7a5996b8f1ea"), request.animalUuid());
        assertEquals("OFFLINE", request.sourceChannel());
        assertEquals("image/jpeg", request.mimeType());
    }

    @Test
    void shouldRejectIncompleteMetadata() {
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "mimeType", "image/jpeg",
                        "fileName", "vaca.jpg",
                        "sizeBytes", 4,
                        "base64Data", Base64.getEncoder().encodeToString("hola".getBytes()),
                        "capturedAt", "2026-04-27T10:00:00Z",
                        "sourceChannel", "offline"),
                OffsetDateTime.parse("2026-04-27T10:05:00Z")));

        assertEquals("ANIMAL_IMAGE_CHECKSUM_REQUIRED", exception.getMessage());
    }

    @Test
    void shouldRejectMimeOutsideV1Allowlist() {
        byte[] content = "hola".getBytes();

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () -> mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "mimeType", "image/webp",
                        "fileName", "vaca.webp",
                        "sizeBytes", content.length,
                        "checksumSha256", AnimalImageSecuritySupport.sha256Hex(content),
                        "base64Data", Base64.getEncoder().encodeToString(content),
                        "capturedAt", "2026-04-27T10:00:00Z",
                        "sourceChannel", "offline"),
                OffsetDateTime.parse("2026-04-27T10:05:00Z")));

        assertEquals("ANIMAL_IMAGE_MIME_TYPE_NOT_ALLOWED", exception.getMessage());
    }

    @Test
    void shouldRejectSizeMismatchAndOutOfScopeFields() {
        byte[] content = "hola".getBytes();

        IllegalArgumentException sizeMismatch = assertThrows(IllegalArgumentException.class, () -> mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "mimeType", "image/png",
                        "fileName", "vaca.png",
                        "sizeBytes", content.length + 1,
                        "checksumSha256", AnimalImageSecuritySupport.sha256Hex(content),
                        "base64Data", Base64.getEncoder().encodeToString(content),
                        "capturedAt", "2026-04-27T10:00:00Z",
                        "sourceChannel", "offline"),
                OffsetDateTime.parse("2026-04-27T10:05:00Z")));

        assertEquals("ANIMAL_IMAGE_SIZE_BYTES_MISMATCH", sizeMismatch.getMessage());

        IllegalArgumentException outOfScope = assertThrows(IllegalArgumentException.class, () -> mapper.toRequest(
                Map.of(
                        "animalUuid", "d249f65d-af66-4488-9e78-7a5996b8f1ea",
                        "operationId", "f0d97cca-d80d-4911-b815-2f6f748ff429",
                        "mimeType", "image/png",
                        "fileName", "vaca.png",
                        "sizeBytes", content.length,
                        "checksumSha256", AnimalImageSecuritySupport.sha256Hex(content),
                        "base64Data", Base64.getEncoder().encodeToString(content),
                        "capturedAt", "2026-04-27T10:00:00Z",
                        "sourceChannel", "offline",
                        "crop", true),
                OffsetDateTime.parse("2026-04-27T10:05:00Z")));

        assertEquals("ANIMAL_IMAGE_OUT_OF_SCOPE_FIELD", outOfScope.getMessage());
    }
}

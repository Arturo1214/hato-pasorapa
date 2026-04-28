package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import bo.pasorapa.hato.service.dto.animalimage.AnimalImageRequest;
import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.service.mapper.AnimalImageMapper;
import bo.pasorapa.hato.service.mapper.AnimalImageSecuritySupport;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AnimalImageStorageServiceTest {

    @Test
    void shouldRejectPathTraversalAndMimeOutsideAllowlist() throws Exception {
        Path rootDir = Files.createTempDirectory("animal-image-storage-test");
        AnimalImageStorageService service = new AnimalImageStorageService(
                new AnimalImageMapper(),
                true,
                rootDir.toString(),
                2 * 1024 * 1024,
                "image/jpeg,image/png");
        byte[] content = "hola".getBytes();

        BusinessException invalidName = assertThrows(BusinessException.class, () -> service.store(new AnimalImageRequest(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "image/jpeg",
                "../vaca.jpg",
                content.length,
                AnimalImageSecuritySupport.sha256Hex(content),
                Base64.getEncoder().encodeToString(content),
                OffsetDateTime.parse("2026-04-27T10:00:00Z"),
                "OFFLINE")));

        assertEquals("ANIMAL_IMAGE_PATH_TRAVERSAL", invalidName.code());

        BusinessException invalidMime = assertThrows(BusinessException.class, () -> service.store(new AnimalImageRequest(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "image/webp",
                "vaca.webp",
                content.length,
                AnimalImageSecuritySupport.sha256Hex(content),
                Base64.getEncoder().encodeToString(content),
                OffsetDateTime.parse("2026-04-27T10:00:00Z"),
                "OFFLINE")));

        assertEquals("ANIMAL_IMAGE_MIME_TYPE_NOT_ALLOWED", invalidMime.code());
    }

    @Test
    void shouldValidateChecksumAndWriteInsideConfiguredRoot() throws Exception {
        Path rootDir = Files.createTempDirectory("animal-image-storage-test-write");
        AnimalImageStorageService service = new AnimalImageStorageService(
                new AnimalImageMapper(),
                true,
                rootDir.toString(),
                2 * 1024 * 1024,
                "image/jpeg,image/png");
        byte[] content = "hola".getBytes();

        var stored = service.store(new AnimalImageRequest(
                UUID.fromString("11111111-1111-1111-1111-111111111111"),
                UUID.fromString("22222222-2222-2222-2222-222222222222"),
                "image/jpeg",
                "vaca.jpg",
                content.length,
                AnimalImageSecuritySupport.sha256Hex(content),
                Base64.getEncoder().encodeToString(content),
                OffsetDateTime.parse("2026-04-27T10:00:00Z"),
                "OFFLINE"));

        assertEquals(true, stored.absolutePath().startsWith(rootDir));
        assertArrayEquals(content, Files.readAllBytes(stored.absolutePath()));

        BusinessException checksumMismatch = assertThrows(BusinessException.class, () -> service.store(new AnimalImageRequest(
                UUID.randomUUID(),
                UUID.randomUUID(),
                "image/png",
                "otra.png",
                content.length,
                "b".repeat(64),
                Base64.getEncoder().encodeToString(content),
                OffsetDateTime.parse("2026-04-27T10:00:00Z"),
                "OFFLINE")));

        assertEquals("ANIMAL_IMAGE_CHECKSUM_MISMATCH", checksumMismatch.code());
    }
}

package bo.pasorapa.hato.service;

import static bo.pasorapa.hato.service.mapper.AnimalImageSecuritySupport.DEFAULT_ALLOWLIST;

import bo.pasorapa.hato.service.dto.animalimage.AnimalImageRequest;
import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.service.mapper.AnimalImageMapper;
import bo.pasorapa.hato.service.mapper.AnimalImageSecuritySupport;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.core.Response;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.format.DateTimeFormatter;
import java.util.Set;
import org.eclipse.microprofile.config.inject.ConfigProperty;

@ApplicationScoped
public class AnimalImageStorageService {

    private static final DateTimeFormatter CAPTURED_BUCKET = DateTimeFormatter.ofPattern("yyyy/MM");

    private final AnimalImageMapper animalImageMapper;
    private final boolean enabled;
    private final Path rootDir;
    private final long maxBytes;
    private final Set<String> mimeAllowlist;

    public AnimalImageStorageService(
            AnimalImageMapper animalImageMapper,
            @ConfigProperty(name = "hato.storage.animal-images.enabled", defaultValue = "true") boolean enabled,
            @ConfigProperty(name = "hato.storage.animal-images.root-dir") String rootDir,
            @ConfigProperty(name = "hato.storage.animal-images.max-bytes", defaultValue = "2097152") long maxBytes,
            @ConfigProperty(name = "hato.storage.animal-images.mime-allowlist", defaultValue = "image/jpeg,image/png") String mimeAllowlist) {
        this.animalImageMapper = animalImageMapper;
        this.enabled = enabled;
        this.rootDir = Path.of(rootDir).normalize().toAbsolutePath();
        this.maxBytes = maxBytes;
        this.mimeAllowlist = mimeAllowlist == null || mimeAllowlist.isBlank()
                ? DEFAULT_ALLOWLIST
                : java.util.Arrays.stream(mimeAllowlist.split(",")).map(String::trim).map(String::toLowerCase).collect(java.util.stream.Collectors.toSet());
    }

    public StoredAnimalImage store(AnimalImageRequest request) {
        if (!enabled) {
            throw new BusinessException("ANIMAL_IMAGE_STORAGE_DISABLED", "El storage local de imágenes está deshabilitado.", Response.Status.SERVICE_UNAVAILABLE);
        }
        if (!AnimalImageSecuritySupport.isAllowedMime(request.mimeType(), mimeAllowlist)) {
            throw new BusinessException("ANIMAL_IMAGE_MIME_TYPE_NOT_ALLOWED", "El MIME de la imagen no está permitido en V1.", Response.Status.BAD_REQUEST);
        }
        if (request.sizeBytes() > maxBytes) {
            throw new BusinessException("ANIMAL_IMAGE_SIZE_BYTES_EXCEEDED", "La imagen excede el límite V1 de 2MB.", Response.Status.BAD_REQUEST);
        }

        byte[] content = animalImageMapper.decodeBase64(request.base64Data());
        if (content.length != request.sizeBytes()) {
            throw new BusinessException("ANIMAL_IMAGE_SIZE_BYTES_MISMATCH", "El tamaño declarado no coincide con el binario recibido.", Response.Status.BAD_REQUEST);
        }
        if (!AnimalImageSecuritySupport.sha256Hex(content).equals(request.checksumSha256())) {
            throw new BusinessException("ANIMAL_IMAGE_CHECKSUM_MISMATCH", "El checksum de la imagen no coincide.", Response.Status.BAD_REQUEST);
        }

        String safeFileName = AnimalImageSecuritySupport.sanitizeFileName(request.fileName());
        if (!safeFileName.equals(request.fileName().trim())) {
            throw new BusinessException("ANIMAL_IMAGE_PATH_TRAVERSAL", "El nombre de archivo de la imagen es inválido.", Response.Status.BAD_REQUEST);
        }
        String extension = safeFileName.contains(".") ? safeFileName.substring(safeFileName.lastIndexOf('.')) : defaultExtensionFor(request.mimeType());
        Path relativePath = Path.of(
                        request.animalUuid().toString(),
                        request.capturedAt().toLocalDateTime().format(CAPTURED_BUCKET),
                        request.operationId() + extension)
                .normalize();
        if (relativePath.isAbsolute() || relativePath.startsWith("..")) {
            throw new BusinessException("ANIMAL_IMAGE_PATH_TRAVERSAL", "La ruta relativa de la imagen es inválida.", Response.Status.BAD_REQUEST);
        }

        Path absolutePath = rootDir.resolve(relativePath).normalize().toAbsolutePath();
        if (!absolutePath.startsWith(rootDir)) {
            throw new BusinessException("ANIMAL_IMAGE_PATH_TRAVERSAL", "La ruta final de la imagen es inválida.", Response.Status.BAD_REQUEST);
        }

        try {
            Files.createDirectories(absolutePath.getParent());
            Files.write(absolutePath, content, StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING, StandardOpenOption.WRITE);
            return new StoredAnimalImage(relativePath.toString().replace('\\', '/'), absolutePath, content.length);
        } catch (Exception exception) {
            throw new IllegalStateException("Could not store animal image content.", exception);
        }
    }

    public byte[] read(String relativePath) {
        Path absolutePath = resolveExisting(relativePath);
        try {
            return Files.readAllBytes(absolutePath);
        } catch (Exception exception) {
            throw new IllegalStateException("Could not read animal image content.", exception);
        }
    }

    public void deleteQuietly(String relativePath) {
        if (relativePath == null || relativePath.isBlank()) {
            return;
        }

        try {
            Files.deleteIfExists(resolveExisting(relativePath));
        } catch (Exception ignored) {
        }
    }

    private Path resolveExisting(String relativePath) {
        Path resolved = rootDir.resolve(relativePath).normalize().toAbsolutePath();
        if (!resolved.startsWith(rootDir)) {
            throw new BusinessException("ANIMAL_IMAGE_PATH_TRAVERSAL", "La ruta de lectura de la imagen es inválida.", Response.Status.BAD_REQUEST);
        }
        return resolved;
    }

    private String defaultExtensionFor(String mimeType) {
        return switch (mimeType) {
            case "image/jpeg" -> ".jpg";
            case "image/png" -> ".png";
            default -> ".bin";
        };
    }

    public record StoredAnimalImage(String relativePath, Path absolutePath, long sizeBytes) {}
}

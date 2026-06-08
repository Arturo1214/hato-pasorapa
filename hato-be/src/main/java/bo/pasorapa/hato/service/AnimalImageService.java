package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.AnimalImage;
import bo.pasorapa.hato.repository.AnimalImageRepository;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.service.dto.animalimage.AnimalImageContentResponse;
import bo.pasorapa.hato.service.dto.animalimage.AnimalImageRequest;
import bo.pasorapa.hato.service.dto.animalimage.AnimalImageResponse;
import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.service.mapper.AnimalImageMapper;
import bo.pasorapa.hato.service.mapper.AnimalImageSecuritySupport;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import java.time.ZoneOffset;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class AnimalImageService {

    private final AnimalImageRepository animalImageRepository;
    private final AnimalRepository animalRepository;
    private final AnimalImageMapper animalImageMapper;
    private final AnimalImageStorageService animalImageStorageService;
    private final AnimalAccessService animalAccessService;

    public AnimalImageService(
            AnimalImageRepository animalImageRepository,
            AnimalRepository animalRepository,
            AnimalImageMapper animalImageMapper,
            AnimalImageStorageService animalImageStorageService,
            AnimalAccessService animalAccessService) {
        this.animalImageRepository = animalImageRepository;
        this.animalRepository = animalRepository;
        this.animalImageMapper = animalImageMapper;
        this.animalImageStorageService = animalImageStorageService;
        this.animalAccessService = animalAccessService;
    }

    @Transactional
    public AnimalImage create(AnimalImageRequest request) {
        return create(request, null);
    }

    public AnimalImage create(AnimalImageRequest request, UUID currentUserId) {
        AnimalImage existing = animalImageRepository.findByOperationId(request.operationId()).orElse(null);
        if (existing != null) {
            animalAccessService.requireAccessibleAnimal(existing.getAnimal(), currentUserId);
            return existing;
        }

        Animal animal = animalRepository.findByUuid(request.animalUuid())
                .orElseThrow(() -> new BusinessException("ANIMAL_NOT_FOUND", "No encontramos el animal solicitado.", Response.Status.NOT_FOUND));
        animalAccessService.requireAccessibleAnimal(animal, currentUserId);

        AnimalImageStorageService.StoredAnimalImage storedImage = animalImageStorageService.store(request);
        try {
            AnimalImage image = new AnimalImage();
            image.setAnimal(animal);
            image.setOperationId(request.operationId());
            image.setFileName(request.fileName());
            image.setMimeType(request.mimeType());
            image.setSizeBytes(request.sizeBytes());
            image.setChecksumSha256(request.checksumSha256());
            image.setRelativePath(storedImage.relativePath());
            image.setCapturedAt(request.capturedAt().withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime());
            image.setSourceChannel(request.sourceChannel());
            animalImageRepository.persist(image);
            animalImageRepository.flush();
            image.setThumbnailRef("/api/animal-images/" + image.getImageId() + "/content");
            animalImageRepository.flush();
            return image;
        } catch (RuntimeException exception) {
            animalImageStorageService.deleteQuietly(storedImage.relativePath());
            throw exception;
        }
    }

    public List<AnimalImageResponse> list(UUID animalUuid) {
        return list(animalUuid, null);
    }

    public List<AnimalImageResponse> list(UUID animalUuid, UUID currentUserId) {
        animalAccessService.requireAccessibleAnimal(animalUuid, currentUserId);
        return animalImageRepository.listByAnimalUuid(animalUuid).stream().map(animalImageMapper::toResponse).toList();
    }

    public AnimalImageContentResponse download(UUID imageId) {
        return download(imageId, null);
    }

    public AnimalImageContentResponse download(UUID imageId, UUID currentUserId) {
        AnimalImage image = animalImageRepository.findByIdOptional(imageId)
                .orElseThrow(() -> new BusinessException("ANIMAL_IMAGE_NOT_FOUND", "No encontramos la imagen solicitada.", Response.Status.NOT_FOUND));
        animalAccessService.requireAccessibleAnimal(image.getAnimal(), currentUserId);
        return new AnimalImageContentResponse(
                animalImageStorageService.read(image.getRelativePath()),
                image.getMimeType(),
                image.getFileName());
    }

    public boolean isAllowedMime(String mimeType) {
        return AnimalImageSecuritySupport.DEFAULT_ALLOWLIST.contains(AnimalImageSecuritySupport.normalizeMime(mimeType));
    }
}

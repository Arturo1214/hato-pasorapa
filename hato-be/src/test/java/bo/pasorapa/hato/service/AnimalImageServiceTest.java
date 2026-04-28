package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.repository.AnimalImageRepository;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import bo.pasorapa.hato.service.dto.animalimage.AnimalImageRequest;
import bo.pasorapa.hato.service.dto.animalimage.AnimalImageResponse;
import bo.pasorapa.hato.service.mapper.AnimalImageSecuritySupport;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AnimalImageServiceTest {

    private static final UUID OWNER_ID = UUID.fromString("83ea4a4f-6f9d-45e3-ba1f-f247857dff67");

    @Inject
    AnimalImageService animalImageService;

    @Inject
    AnimalImageRepository animalImageRepository;

    @Inject
    AnimalRepository animalRepository;

    @Inject
    GanaderoRepository ganaderoRepository;

    @Inject
    IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            integrationDatabaseCleaner.clean();
            Ganadero ganadero = new Ganadero();
            ganadero.setId(OWNER_ID);
            ganadero.setBusinessIdentifier("NIT-IMAGE-OWNER");
            ganadero.setName("Ganadero Images");
            ganadero.setActive(true);
            ganaderoRepository.persist(ganadero);
        });
    }

    @Test
    void shouldCreateAppendOnlyAnimalImagesIdempotentlyAndListInDeterministicOrder() {
        UUID animalUuid = UUID.fromString("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
        seedAnimal(animalUuid, "AR-image");

        AnimalImageRequest first = request(animalUuid, UUID.fromString("11111111-1111-1111-1111-111111111111"), "2026-04-27T10:00:00Z");
        AnimalImageRequest second = request(animalUuid, UUID.fromString("22222222-2222-2222-2222-222222222222"), "2026-04-27T11:00:00Z");

        var created = animalImageService.create(first);
        var replayed = animalImageService.create(first);
        animalImageService.create(second);

        List<AnimalImageResponse> listed = animalImageService.list(animalUuid);

        assertEquals(created.getImageId(), replayed.getImageId());
        assertEquals(2, animalImageRepository.count());
        assertEquals(List.of(first.operationId(), second.operationId()), listed.stream().map(AnimalImageResponse::operationId).toList());
    }

    private AnimalImageRequest request(UUID animalUuid, UUID operationId, String capturedAt) {
        byte[] content = ("image-" + operationId).getBytes();
        return new AnimalImageRequest(
                animalUuid,
                operationId,
                "image/jpeg",
                operationId + ".jpg",
                content.length,
                AnimalImageSecuritySupport.sha256Hex(content),
                Base64.getEncoder().encodeToString(content),
                OffsetDateTime.parse(capturedAt),
                "OFFLINE");
    }

    private void seedAnimal(UUID animalUuid, String tag) {
        QuarkusTransaction.requiringNew().run(() -> {
            Animal animal = new Animal();
            animal.setUuid(animalUuid);
            animal.setCode("CODE-" + tag);
            animal.setTag("TAG-" + tag);
            animal.setArete(tag);
            animal.setAreteNormalized(tag.toLowerCase());
            animal.setMarca("Marca " + tag);
            animal.setMarcaNormalized(("Marca " + tag).toLowerCase());
            animal.setOwnerGanadero(ganaderoRepository.findByIdOptional(OWNER_ID).orElseThrow());
            animal.setCategory(AnimalCategory.COW);
            animal.setActive(true);
            animal.setAdmissionDate(LocalDate.of(2024, 1, 1));
            animal.setWeightKg(new BigDecimal("400.00"));
            animal.setCreatedAt(LocalDateTime.of(2026, 4, 27, 8, 0));
            animal.setUpdatedAt(LocalDateTime.of(2026, 4, 27, 8, 0));
            animal.setVersion(0L);
            animalRepository.persist(animal);
        });
    }
}

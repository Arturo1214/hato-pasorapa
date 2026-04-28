package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.repository.AnimalEventRepository;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import bo.pasorapa.hato.service.dto.AnimalRequest;
import bo.pasorapa.hato.service.error.BusinessException;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AnimalServiceTest {

    @Inject
    AnimalService animalService;

    @Inject
    AnimalRepository animalRepository;

    @Inject
    AnimalEventRepository animalEventRepository;

    @Inject
    GanaderoRepository ganaderoRepository;

    @Inject
    IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            integrationDatabaseCleaner.clean();
            ganaderoRepository.persist(buildGanadero(UUID.fromString("95315ab0-0f7c-4b94-a55e-912d179a702c"), "NIT-ANIMAL-001", "Ganadero Uno"));
            ganaderoRepository.persist(buildGanadero(UUID.fromString("0bc0253e-c4b0-4fc3-94bd-669032bce518"), "NIT-ANIMAL-002", "Ganadero Dos"));
            animalRepository.persist(buildAnimal(
                    UUID.fromString("0b79206a-ec9c-4ebc-bb90-0992f57f9687"),
                    UUID.fromString("95315ab0-0f7c-4b94-a55e-912d179a702c"),
                    " BO-1000 ",
                    "Marca Base",
                    "Tatuaje Base"));
        });
    }

    @Test
    void shouldRejectCreateWhenOwnerGanaderoDoesNotExist() {
        BusinessException exception = assertThrows(BusinessException.class, () -> QuarkusTransaction.requiringNew().call(() ->
                animalService.create(new AnimalRequest(
                        UUID.fromString("11111111-1111-1111-1111-111111111111"),
                        "BO-2000",
                        null,
                        null,
                        AnimalCategory.COW,
                        true,
                        LocalDate.of(2024, 2, 1),
                        new BigDecimal("410.50")))));

        assertEquals("ANIMAL_OWNER_NOT_FOUND", exception.code());
    }

    @Test
    void shouldRequireAtLeastOneVisibleIdentifier() {
        BusinessException exception = assertThrows(BusinessException.class, () -> QuarkusTransaction.requiringNew().call(() ->
                animalService.create(new AnimalRequest(
                        UUID.fromString("95315ab0-0f7c-4b94-a55e-912d179a702c"),
                        " ",
                        null,
                        null,
                        AnimalCategory.COW,
                        true,
                        LocalDate.of(2024, 2, 1),
                        new BigDecimal("410.50")))));

        assertEquals("ANIMAL_VISIBLE_IDENTIFIER_REQUIRED", exception.code());
    }

    @Test
    void shouldRejectNormalizedAreteCollision() {
        BusinessException exception = assertThrows(BusinessException.class, () -> QuarkusTransaction.requiringNew().call(() ->
                animalService.create(new AnimalRequest(
                        UUID.fromString("0bc0253e-c4b0-4fc3-94bd-669032bce518"),
                        "bo-1000",
                        "Otra Marca",
                        null,
                        AnimalCategory.COW,
                        true,
                        LocalDate.of(2024, 3, 1),
                        new BigDecimal("390.00")))));

        assertEquals("ANIMAL_ARETE_ALREADY_EXISTS", exception.code());
    }

    @Test
    void shouldAllowRepeatedMarcaAndTatuajeAcrossDifferentAnimals() {
        assertDoesNotThrow(() -> QuarkusTransaction.requiringNew().call(() ->
                animalService.create(new AnimalRequest(
                        UUID.fromString("0bc0253e-c4b0-4fc3-94bd-669032bce518"),
                        "BO-3000",
                        "Marca Base",
                        "Tatuaje Base",
                        AnimalCategory.COW,
                        true,
                        LocalDate.of(2024, 3, 1),
                        new BigDecimal("390.00")))));
    }

    private Ganadero buildGanadero(UUID id, String businessIdentifier, String name) {
        Ganadero ganadero = new Ganadero();
        ganadero.setId(id);
        ganadero.setBusinessIdentifier(businessIdentifier);
        ganadero.setName(name);
        ganadero.setActive(true);
        return ganadero;
    }

    private Animal buildAnimal(UUID uuid, UUID ownerGanaderoId, String arete, String marca, String tatuaje) {
        Animal animal = new Animal();
        animal.setUuid(uuid);
        animal.setOwnerGanadero(ganaderoRepository.findByIdOptional(ownerGanaderoId).orElseThrow());
        animal.setArete(arete);
        animal.setMarca(marca);
        animal.setTatuaje(tatuaje);
        animal.setAreteNormalized(arete == null ? null : arete.trim().toLowerCase());
        animal.setMarcaNormalized(marca == null ? null : marca.trim().toLowerCase());
        animal.setTatuajeNormalized(tatuaje == null ? null : tatuaje.trim().toLowerCase());
        animal.setTag(arete);
        animal.setCode(marca);
        animal.setCategory(AnimalCategory.COW);
        animal.setActive(true);
        animal.setAdmissionDate(LocalDate.of(2024, 1, 10));
        animal.setWeightKg(new BigDecimal("420.50"));
        return animal;
    }
}

package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AnimalRepositoryTest {

    private static final UUID OWNER_ID = UUID.fromString("01010101-0101-4101-8101-010101010101");

    @Inject AnimalRepository animalRepository;
    @Inject GanaderoRepository ganaderoRepository;
    @Inject IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            integrationDatabaseCleaner.clean();
            ganaderoRepository.persist(buildGanadero());
            animalRepository.persist(buildAnimal(UUID.fromString("11111111-1111-4111-8111-111111111111"), AnimalCategory.TORO, AnimalSex.MACHO));
            animalRepository.persist(buildAnimal(UUID.fromString("22222222-2222-4222-8222-222222222222"), AnimalCategory.TORO, AnimalSex.MACHO));
            animalRepository.persist(buildAnimal(UUID.fromString("33333333-3333-4333-8333-333333333333"), AnimalCategory.TORO, null));
            animalRepository.persist(buildAnimal(UUID.fromString("44444444-4444-4444-8444-444444444444"), AnimalCategory.VACA, AnimalSex.HEMBRA));
        });
    }

    @Test
    void shouldCountByOwnerAndSexAndCategoryExcludingNullSex() {
        long machos = QuarkusTransaction.requiringNew()
                .call(() -> animalRepository.countByOwnerAndSexAndCategory(OWNER_ID, AnimalSex.MACHO, AnimalCategory.TORO));
        long hembras = QuarkusTransaction.requiringNew()
                .call(() -> animalRepository.countByOwnerAndSexAndCategory(OWNER_ID, AnimalSex.HEMBRA, AnimalCategory.VACA));

        assertEquals(2L, machos);
        assertEquals(1L, hembras);
    }

    private Ganadero buildGanadero() {
        Ganadero ganadero = new Ganadero();
        ganadero.setId(OWNER_ID);
        ganadero.setBusinessIdentifier("NIT-REPO-001");
        ganadero.setName("Ganadero Repository");
        ganadero.setActive(true);
        return ganadero;
    }

    private Animal buildAnimal(UUID uuid, AnimalCategory category, AnimalSex sex) {
        Animal animal = new Animal();
        animal.setUuid(uuid);
        animal.setCode("CODE-" + uuid);
        animal.setTag("TAG-" + uuid);
        animal.setArete("AR-" + uuid.toString().substring(0, 8));
        animal.setAreteNormalized(animal.getArete().toLowerCase());
        animal.setMarca("Marca " + uuid.toString().substring(0, 4));
        animal.setMarcaNormalized(animal.getMarca().toLowerCase());
        animal.setOwnerGanadero(ganaderoRepository.findByIdOptional(OWNER_ID).orElseThrow());
        animal.setCategory(category);
        animal.setSex(sex);
        animal.setActive(true);
        animal.setAdmissionDate(LocalDate.of(2024, 1, 1));
        animal.setWeightKg(new BigDecimal("400.00"));
        animal.setCreatedAt(LocalDateTime.of(2026, 4, 27, 8, 0));
        animal.setUpdatedAt(LocalDateTime.of(2026, 4, 27, 8, 0));
        animal.setVersion(0L);
        return animal;
    }
}

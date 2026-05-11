package bo.pasorapa.hato.service.mapper;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.Raza;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.service.dto.AnimalRequest;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class AnimalMapperTest {

    private final AnimalMapper mapper = new AnimalMapper();

    @Test
    void shouldMapAnimalCharacteristicsAndBreedNameToResponse() {
        UUID breedUuid = UUID.fromString("00000000-0000-4000-8000-000000000001");
        Animal animal = baseAnimal();
        animal.setColor("Colorado");
        animal.setDescription("Bueno para carne");
        animal.setBreed(buildBreed(breedUuid, "Criolla"));

        var response = mapper.toResponse(animal);

        assertEquals("Colorado", response.color());
        assertEquals("Bueno para carne", response.description());
        assertEquals(breedUuid, response.breedUuid());
        assertEquals("Criolla", response.breedName());
    }

    @Test
    void shouldMapNullableAnimalCharacteristicsWithoutBreed() {
        Animal animal = baseAnimal();

        var response = mapper.toResponse(animal);

        assertNull(response.color());
        assertNull(response.description());
        assertNull(response.breedUuid());
        assertNull(response.breedName());
    }

    @Test
    void shouldApplyRequestCharacteristicsAndResolvedBreedToEntity() {
        UUID breedUuid = UUID.fromString("00000000-0000-4000-8000-000000000002");
        Animal animal = baseAnimal();
        AnimalRequest request = new AnimalRequest(
                animal.getOwnerGanadero().getId(),
                null,
                null,
                "BO-2000",
                null,
                null,
                AnimalCategory.VACA,
                AnimalSex.HEMBRA,
                true,
                LocalDate.of(2024, 2, 1),
                new BigDecimal("410.50"),
                null,
                "Overo",
                "Mansa",
                breedUuid);

        mapper.updateEntity(animal, request, animal.getOwnerGanadero(), buildBreed(breedUuid, "Nelore"));

        assertEquals("Overo", animal.getColor());
        assertEquals("Mansa", animal.getDescription());
        assertEquals(breedUuid, animal.getBreed().getUuid());
        assertEquals("Nelore", animal.getBreed().getNombre());
    }

    private Animal baseAnimal() {
        Ganadero owner = new Ganadero();
        owner.setId(UUID.fromString("95315ab0-0f7c-4b94-a55e-912d179a702c"));
        Animal animal = new Animal();
        animal.setUuid(UUID.fromString("0b79206a-ec9c-4ebc-bb90-0992f57f9687"));
        animal.setOwnerGanadero(owner);
        animal.setArete("BO-1000");
        animal.setCategory(AnimalCategory.VACA);
        animal.setSex(AnimalSex.HEMBRA);
        animal.setActive(true);
        animal.setAdmissionDate(LocalDate.of(2024, 1, 10));
        animal.setWeightKg(new BigDecimal("420.50"));
        return animal;
    }

    private Raza buildBreed(UUID uuid, String nombre) {
        Raza raza = new Raza();
        raza.setUuid(uuid);
        raza.setNombre(nombre);
        raza.setNombreNormalizado(nombre.toLowerCase());
        raza.setActivo(true);
        raza.setSortOrder(1);
        return raza;
    }
}

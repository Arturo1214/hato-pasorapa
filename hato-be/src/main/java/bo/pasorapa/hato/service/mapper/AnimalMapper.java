package bo.pasorapa.hato.service.mapper;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.Raza;
import bo.pasorapa.hato.service.dto.AnimalRequest;
import bo.pasorapa.hato.service.dto.AnimalResponse;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class AnimalMapper {

    public Animal toEntity(AnimalRequest request) {
        Animal animal = new Animal();
        updateEntity(animal, request, null);
        return animal;
    }

    public void updateEntity(Animal animal, AnimalRequest request, Ganadero ownerGanadero) {
        updateEntity(animal, request, ownerGanadero, null);
    }

    public void updateEntity(Animal animal, AnimalRequest request, Ganadero ownerGanadero, Raza breed) {
        if (ownerGanadero != null) {
            animal.setOwnerGanadero(ownerGanadero);
        }
        animal.setMotherAnimalUuid(request.motherAnimalUuid());
        animal.setFatherAnimalUuid(request.fatherAnimalUuid());
        animal.setArete(request.arete());
        animal.setMarca(request.marca());
        animal.setTatuaje(request.tatuaje());
        animal.setCategory(request.category());
        animal.setSex(request.sex());
        animal.setActive(request.active());
        animal.setAdmissionDate(request.admissionDate());
        animal.setWeightKg(request.weightKg());
        animal.setBirthDate(request.birthDate());
        animal.setColor(cleanOptional(request.color()));
        if (request.description() != null) {
            animal.setDescription(cleanOptional(request.description()));
        }
        if (request.breedUuid() != null || breed != null) {
            animal.setBreed(breed);
        }
    }

    public AnimalResponse toResponse(Animal animal) {
        return new AnimalResponse(
                animal.getUuid(),
                animal.getOwnerGanadero().getId(),
                animal.getMotherAnimalUuid(),
                animal.getFatherAnimalUuid(),
                animal.getArete(),
                animal.getMarca(),
                animal.getTatuaje(),
                animal.getCategory(),
                animal.getSex(),
                animal.getActive(),
                animal.getBirthDate(),
                animal.getAdmissionDate(),
                animal.getWeightKg(),
                animal.getColor(),
                animal.getDescription(),
                animal.getBreed() == null ? null : animal.getBreed().getUuid(),
                animal.getBreed() == null ? null : animal.getBreed().getNombre(),
                animal.getCreatedAt(),
                animal.getVersion(),
                animal.getUpdatedAt(),
                animal.getLastSyncedAt()
        );
    }

    private String cleanOptional(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        return value.trim();
    }
}

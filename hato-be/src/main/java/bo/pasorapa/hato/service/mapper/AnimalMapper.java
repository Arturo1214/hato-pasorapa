package bo.pasorapa.hato.service.mapper;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.Ganadero;
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
        if (ownerGanadero != null) {
            animal.setOwnerGanadero(ownerGanadero);
        }
        animal.setArete(request.arete());
        animal.setMarca(request.marca());
        animal.setTatuaje(request.tatuaje());
        animal.setCategory(request.category());
        animal.setActive(request.active());
        animal.setAdmissionDate(request.admissionDate());
        animal.setWeightKg(request.weightKg());
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
                animal.getActive(),
                animal.getBirthDate(),
                animal.getAdmissionDate(),
                animal.getWeightKg(),
                animal.getCreatedAt(),
                animal.getVersion(),
                animal.getUpdatedAt(),
                animal.getLastSyncedAt()
        );
    }
}

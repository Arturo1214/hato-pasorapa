package bo.pasorapa.hato.service.mapper;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.service.dto.AnimalRequest;
import bo.pasorapa.hato.service.dto.AnimalResponse;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class AnimalMapper {

    public Animal toEntity(AnimalRequest request) {
        Animal animal = new Animal();
        updateEntity(animal, request);
        return animal;
    }

    public void updateEntity(Animal animal, AnimalRequest request) {
        animal.setCode(request.code());
        animal.setTag(request.tag());
        animal.setCategory(request.category());
        animal.setActive(request.active());
        animal.setAdmissionDate(request.admissionDate());
        animal.setWeightKg(request.weightKg());
    }

    public AnimalResponse toResponse(Animal animal) {
        return new AnimalResponse(
                animal.getId(),
                animal.getUuid(),
                animal.getCode(),
                animal.getTag(),
                animal.getCategory(),
                animal.getActive(),
                animal.getAdmissionDate(),
                animal.getWeightKg(),
                animal.getCreatedAt(),
                animal.getVersion(),
                animal.getUpdatedAt(),
                animal.getLastSyncedAt()
        );
    }
}

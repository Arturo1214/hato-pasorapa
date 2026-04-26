package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.service.dto.AnimalRequest;
import bo.pasorapa.hato.service.mapper.AnimalMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;

@ApplicationScoped
public class AnimalService {

    private final AnimalRepository animalRepository;
    private final AnimalMapper animalMapper;

    public AnimalService(AnimalRepository animalRepository, AnimalMapper animalMapper) {
        this.animalRepository = animalRepository;
        this.animalMapper = animalMapper;
    }

    @Transactional
    public Animal create(AnimalRequest request) {
        validateUnique(request.code(), request.tag(), null);
        Animal animal = animalMapper.toEntity(request);
        animalRepository.persist(animal);
        return animal;
    }

    @Transactional
    public Animal update(Long id, AnimalRequest request) {
        Animal animal = animalRepository.findByIdOptional(id)
                .orElseThrow(() -> new NotFoundException("No se encontró el animal con id " + id));

        validateUnique(request.code(), request.tag(), id);
        animalMapper.updateEntity(animal, request);
        return animal;
    }

    @Transactional
    public void delete(Long id) {
        boolean deleted = animalRepository.deleteById(id);
        if (!deleted) {
            throw new NotFoundException("No se encontró el animal con id " + id);
        }
    }

    private void validateUnique(String code, String tag, Long currentId) {
        animalRepository.findByCode(code)
                .filter(found -> currentId == null || !found.getId().equals(currentId))
                .ifPresent(found -> {
                    throw new BadRequestException("Ya existe un animal con code " + code);
                });

        animalRepository.findByTag(tag)
                .filter(found -> currentId == null || !found.getId().equals(currentId))
                .ifPresent(found -> {
                    throw new BadRequestException("Ya existe un animal con tag " + tag);
                });
    }
}

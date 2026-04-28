package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.service.dto.AnimalRequest;
import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.service.mapper.AnimalMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import java.util.Objects;
import java.util.UUID;

@ApplicationScoped
public class AnimalService {

    private final AnimalRepository animalRepository;
    private final GanaderoRepository ganaderoRepository;
    private final AnimalMapper animalMapper;

    public AnimalService(AnimalRepository animalRepository, GanaderoRepository ganaderoRepository, AnimalMapper animalMapper) {
        this.animalRepository = animalRepository;
        this.ganaderoRepository = ganaderoRepository;
        this.animalMapper = animalMapper;
    }

    @Transactional
    public Animal create(AnimalRequest request) {
        return createWithUuid(null, request);
    }

    @Transactional
    public Animal createWithUuid(UUID uuid, AnimalRequest request) {
        var ownerGanadero = resolveOwner(request.ownerGanaderoId());
        Animal animal = animalMapper.toEntity(request);
        if (uuid != null) {
            animal.setUuid(uuid);
        }
        applyCoreState(animal, request, ownerGanadero);
        animalRepository.persist(animal);
        return animal;
    }

    @Transactional
    public Animal update(UUID uuid, AnimalRequest request) {
        Animal animal = animalRepository.findByUuid(uuid)
                .orElseThrow(() -> new BusinessException("ANIMAL_NOT_FOUND", "No encontramos el animal solicitado.", Response.Status.NOT_FOUND));

        var ownerGanadero = resolveOwner(request.ownerGanaderoId());
        applyCoreState(animal, request, ownerGanadero);
        return animal;
    }

    @Transactional
    public void delete(UUID uuid) {
        boolean deleted = animalRepository.delete("uuid", uuid) > 0;
        if (!deleted) {
            throw new BusinessException("ANIMAL_NOT_FOUND", "No encontramos el animal solicitado.", Response.Status.NOT_FOUND);
        }
    }

    private void applyCoreState(Animal animal, AnimalRequest request, bo.pasorapa.hato.domain.Ganadero ownerGanadero) {
        String normalizedArete = normalizeVisible(request.arete());
        String normalizedMarca = normalizeVisible(request.marca());
        String normalizedTatuaje = normalizeVisible(request.tatuaje());
        validateVisibleIdentifiers(normalizedArete, normalizedMarca, normalizedTatuaje, animal.getId());

        AnimalRequest normalizedRequest = new AnimalRequest(
                request.ownerGanaderoId(),
                normalizedArete,
                normalizedMarca,
                normalizedTatuaje,
                request.category(),
                request.active(),
                request.admissionDate(),
                request.weightKg());

        animalMapper.updateEntity(animal, normalizedRequest, ownerGanadero);
        animal.setAreteNormalized(toNormalizedKey(normalizedArete));
        animal.setMarcaNormalized(toNormalizedKey(normalizedMarca));
        animal.setTatuajeNormalized(toNormalizedKey(normalizedTatuaje));
        animal.setCode(resolveLegacyCode(animal));
        animal.setTag(resolveLegacyTag(animal, normalizedArete));
    }

    private bo.pasorapa.hato.domain.Ganadero resolveOwner(UUID ownerGanaderoId) {
        return ganaderoRepository.findByIdOptional(ownerGanaderoId)
                .orElseThrow(() -> new BusinessException("ANIMAL_OWNER_NOT_FOUND", "No encontramos el ganadero propietario indicado.", Response.Status.NOT_FOUND));
    }

    private void validateVisibleIdentifiers(String arete, String marca, String tatuaje, Long currentId) {
        if (arete == null && marca == null && tatuaje == null) {
            throw new BusinessException("ANIMAL_VISIBLE_IDENTIFIER_REQUIRED", "Debés informar al menos un identificador visible.", Response.Status.BAD_REQUEST);
        }

        if (arete == null) {
            return;
        }

        animalRepository.findByNormalizedArete(arete)
                .filter(found -> currentId == null || !Objects.equals(found.getId(), currentId))
                .ifPresent(found -> {
                    throw new BusinessException("ANIMAL_ARETE_ALREADY_EXISTS", "Ya existe un animal con ese arete.", Response.Status.CONFLICT);
                });
    }

    private String normalizeVisible(String value) {
        if (value == null) {
            return null;
        }
        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private String toNormalizedKey(String value) {
        return value == null ? null : value.toLowerCase();
    }

    private String resolveLegacyCode(Animal animal) {
        return animal.getCode() == null || animal.getCode().isBlank() ? UUID.randomUUID().toString() : animal.getCode();
    }

    private String resolveLegacyTag(Animal animal, String normalizedArete) {
        if (normalizedArete != null) {
            return normalizedArete;
        }
        return animal.getTag() == null || animal.getTag().isBlank() ? UUID.randomUUID().toString() : animal.getTag();
    }
}

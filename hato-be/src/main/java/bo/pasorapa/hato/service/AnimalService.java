package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.AnimalEvent;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalEventType;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.repository.AnimalEventRepository;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.service.dto.AnimalRequest;
import bo.pasorapa.hato.service.dto.animalevent.AnimalEventRequest;
import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.service.mapper.AnimalEventMapper;
import bo.pasorapa.hato.service.mapper.AnimalMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

@ApplicationScoped
public class AnimalService {

    private final AnimalRepository animalRepository;
    private final AnimalEventRepository animalEventRepository;
    private final GanaderoRepository ganaderoRepository;
    private final AnimalMapper animalMapper;
    private final AnimalEventMapper animalEventMapper;

    public AnimalService(
            AnimalRepository animalRepository,
            AnimalEventRepository animalEventRepository,
            GanaderoRepository ganaderoRepository,
            AnimalMapper animalMapper,
            AnimalEventMapper animalEventMapper) {
        this.animalRepository = animalRepository;
        this.animalEventRepository = animalEventRepository;
        this.ganaderoRepository = ganaderoRepository;
        this.animalMapper = animalMapper;
        this.animalEventMapper = animalEventMapper;
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
        Animal animal = findByUuid(uuid);

        var ownerGanadero = resolveOwner(request.ownerGanaderoId());
        applyCoreState(animal, request, ownerGanadero);
        return animal;
    }

    @Transactional
    public Animal findByUuid(UUID uuid) {
        Animal animal = animalRepository.findByUuid(uuid)
                .orElseThrow(() -> new BusinessException("ANIMAL_NOT_FOUND", "No encontramos el animal solicitado.", Response.Status.NOT_FOUND));
        applyAutoTransitionOnRead(animal);
        return animal;
    }

    @Transactional
    public void applyAutoTransitionsOnRead(List<Animal> animals) {
        animals.forEach(this::applyAutoTransitionOnRead);
    }

    @Transactional
    public AnimalEvent applyCastration(AnimalEventRequest request, UUID authenticatedUserId) {
        AnimalEvent existing = animalEventRepository.findByOperationId(request.operationId()).orElse(null);
        if (existing != null) {
            return existing;
        }

        Animal animal = animalRepository.findByUuid(request.animalUuid())
                .orElseThrow(() -> new BusinessException("ANIMAL_NOT_FOUND", "No encontramos el animal solicitado.", Response.Status.NOT_FOUND));

        UUID effectivePerformedByUserId = resolvePerformedByUserId(request, authenticatedUserId);
        AnimalEvent event = animalEventMapper.toEntity(animal, request, effectivePerformedByUserId);
        animalEventRepository.persist(event);
        animalEventRepository.flush();
        applyCastrationTransition(animal);
        animalRepository.flush();
        return event;
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
                request.sex(),
                request.active(),
                request.admissionDate(),
                request.weightKg(),
                request.birthDate());

        applyCategorySexValidation(normalizedRequest.category(), normalizedRequest.sex());
        validateBirthDateForYoungAnimals(normalizedRequest);

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

    private void applyCategorySexValidation(AnimalCategory category, AnimalSex sex) {
        boolean valid = switch (sex) {
            case HEMBRA -> category == AnimalCategory.TERNERA || category == AnimalCategory.VAQUILLONA || category == AnimalCategory.VACA;
            case MACHO -> category == AnimalCategory.TERNERO || category == AnimalCategory.TORO || category == AnimalCategory.BUEY;
        };

        if (!valid) {
            throw new BusinessException(
                    "INVALID_SEX_CATEGORY_COMBINATION",
                    category + " requires " + requiredSex(category) + ", received " + sex,
                    Response.Status.BAD_REQUEST);
        }
    }

    private void validateBirthDateForYoungAnimals(AnimalRequest request) {
        if ((request.category() == AnimalCategory.TERNERO || request.category() == AnimalCategory.TERNERA)
                && request.birthDate() == null) {
            throw new BusinessException(
                    "BIRTH_DATE_REQUIRED_FOR_YOUNG_ANIMAL",
                    "birthDate es requerido para TERNERO/TERNERA",
                    Response.Status.BAD_REQUEST);
        }
    }

    private void applyAutoTransitionOnRead(Animal animal) {
        if (animal.getCategory() != AnimalCategory.TERNERO || animal.getBirthDate() == null) {
            return;
        }

        long monthsSinceBirth = ChronoUnit.MONTHS.between(animal.getBirthDate(), LocalDate.now());
        if (monthsSinceBirth >= 24) {
            animal.setCategory(AnimalCategory.TORO);
        }
    }

    private void applyCastrationTransition(Animal animal) {
        if (animal.getCategory() == AnimalCategory.TERNERO || animal.getCategory() == AnimalCategory.TORO) {
            animal.setCategory(AnimalCategory.BUEY);
        }
    }

    private UUID resolvePerformedByUserId(AnimalEventRequest request, UUID authenticatedUserId) {
        if (authenticatedUserId != null && request.performedByUserId() != null && !authenticatedUserId.equals(request.performedByUserId())) {
            throw new BusinessException(
                    "ANIMAL_EVENT_PERFORMED_BY_MISMATCH",
                    "El actor del payload no coincide con el usuario autenticado.",
                    Response.Status.BAD_REQUEST);
        }

        UUID effectiveUserId = authenticatedUserId != null ? authenticatedUserId : request.performedByUserId();
        if (effectiveUserId == null) {
            throw new BusinessException(
                    "ANIMAL_EVENT_PERFORMED_BY_REQUIRED",
                    "Necesitamos identificar al usuario que realizó el evento.",
                    Response.Status.BAD_REQUEST);
        }
        return effectiveUserId;
    }

    private AnimalSex requiredSex(AnimalCategory category) {
        return switch (category) {
            case TERNERA, VAQUILLONA, VACA -> AnimalSex.HEMBRA;
            case TERNERO, TORO, BUEY -> AnimalSex.MACHO;
        };
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

package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.AnimalEvent;
import bo.pasorapa.hato.domain.AnimalEventLog;
import bo.pasorapa.hato.domain.Raza;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalEventType;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.repository.AnimalEventLogRepository;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.RazaRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.dto.AnimalRequest;
import bo.pasorapa.hato.service.dto.AnimalGenealogyResponse;
import bo.pasorapa.hato.service.dto.AnimalGenealogyResponse.AnimalGenealogyNode;
import bo.pasorapa.hato.service.dto.animalevent.AnimalEventRequest;
import bo.pasorapa.hato.service.dto.animalreproductionevent.AnimalReproductionEventRequest;
import bo.pasorapa.hato.service.dto.birthregistration.BirthRegistrationRequest;
import bo.pasorapa.hato.service.dto.birthregistration.BirthRegistrationResponse;
import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.service.mapper.AnimalEventMapper;
import bo.pasorapa.hato.service.mapper.AnimalMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@ApplicationScoped
public class AnimalService {

    private static final int DEFAULT_GENEALOGY_GENERATIONS = 1;
    private static final int MAX_GENEALOGY_GENERATIONS = 3;

    private final AnimalRepository animalRepository;
    private final AnimalEventLogRepository animalEventLogRepository;
    private final GanaderoRepository ganaderoRepository;
    private final UserRepository userRepository;
    private final RazaRepository razaRepository;
    private final AnimalMapper animalMapper;
    private final AnimalEventMapper animalEventMapper;
    private final AnimalReproductionEventService animalReproductionEventService;

    public AnimalService(
            AnimalRepository animalRepository,
            AnimalEventLogRepository animalEventLogRepository,
            GanaderoRepository ganaderoRepository,
            UserRepository userRepository,
            RazaRepository razaRepository,
            AnimalMapper animalMapper,
            AnimalEventMapper animalEventMapper,
            AnimalReproductionEventService animalReproductionEventService) {
        this.animalRepository = animalRepository;
        this.animalEventLogRepository = animalEventLogRepository;
        this.ganaderoRepository = ganaderoRepository;
        this.userRepository = userRepository;
        this.razaRepository = razaRepository;
        this.animalMapper = animalMapper;
        this.animalEventMapper = animalEventMapper;
        this.animalReproductionEventService = animalReproductionEventService;
    }

    @Transactional
    public Animal create(AnimalRequest request) {
        return createWithUuid(null, request, null);
    }

    @Transactional
    public Animal create(AnimalRequest request, UUID currentUserId) {
        return createWithUuid(null, request, currentUserId);
    }

    @Transactional
    public Animal createWithUuid(UUID uuid, AnimalRequest request) {
        return createWithUuid(uuid, request, null);
    }

    @Transactional
    public Animal createWithUuid(UUID uuid, AnimalRequest request, UUID currentUserId) {
        var ownerGanadero = resolveOwner(request.ownerGanaderoId(), currentUserId);
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
        return update(uuid, request, null);
    }

    @Transactional
    public Animal update(UUID uuid, AnimalRequest request, UUID currentUserId) {
        Animal animal = findByUuid(uuid, currentUserId);

        var ownerGanadero = resolveOwner(request.ownerGanaderoId(), currentUserId);
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
    public Animal findByUuid(UUID uuid, UUID currentUserId) {
        Animal animal = findByUuid(uuid);
        enforceAnimalOwnershipForCurrentUser(animal, currentUserId);
        return animal;
    }

    @Transactional
    public AnimalGenealogyResponse findGenealogy(UUID uuid, UUID currentUserId) {
        return findGenealogy(uuid, currentUserId, DEFAULT_GENEALOGY_GENERATIONS);
    }

    @Transactional
    public AnimalGenealogyResponse findGenealogy(UUID uuid, UUID currentUserId, Integer generations) {
        Animal animal = findByUuid(uuid);
        UUID allowedGanaderoId = resolveAllowedGanaderoId(currentUserId);
        enforceAnimalOwnership(animal, allowedGanaderoId);
        int safeGenerations = clampGenealogyGenerations(generations);

        Animal mother = animal.getMotherAnimalUuid() == null
                ? null
                : animalRepository.findByUuid(animal.getMotherAnimalUuid()).filter(relative -> canExposeRelative(relative, allowedGanaderoId)).orElse(null);
        Animal father = animal.getFatherAnimalUuid() == null
                ? null
                : animalRepository.findByUuid(animal.getFatherAnimalUuid()).filter(relative -> canExposeRelative(relative, allowedGanaderoId)).orElse(null);
        List<Animal> offspring = animalRepository.listOffspringByParentUuid(uuid).stream()
                .filter(relative -> canExposeRelative(relative, allowedGanaderoId))
                .toList();

        return new AnimalGenealogyResponse(
                animalMapper.toResponse(animal),
                mother == null ? null : animalMapper.toResponse(mother),
                father == null ? null : animalMapper.toResponse(father),
                offspring.stream().map(animalMapper::toResponse).toList(),
                buildAncestorNode(animal, allowedGanaderoId, safeGenerations));
    }

    private int clampGenealogyGenerations(Integer generations) {
        if (generations == null) {
            return DEFAULT_GENEALOGY_GENERATIONS;
        }
        return Math.max(1, Math.min(generations, MAX_GENEALOGY_GENERATIONS));
    }

    private AnimalGenealogyNode buildAncestorNode(Animal animal, UUID allowedGanaderoId, int generationsRemaining) {
        if (generationsRemaining <= 0) {
            return new AnimalGenealogyNode(animalMapper.toResponse(animal), null, null);
        }

        return new AnimalGenealogyNode(
                animalMapper.toResponse(animal),
                resolveAncestorParent(animal.getMotherAnimalUuid(), allowedGanaderoId, generationsRemaining - 1),
                resolveAncestorParent(animal.getFatherAnimalUuid(), allowedGanaderoId, generationsRemaining - 1));
    }

    private AnimalGenealogyNode resolveAncestorParent(UUID parentUuid, UUID allowedGanaderoId, int generationsRemaining) {
        if (parentUuid == null) {
            return null;
        }

        return animalRepository.findByUuid(parentUuid)
                .filter(relative -> canExposeRelative(relative, allowedGanaderoId))
                .map(relative -> buildAncestorNode(relative, allowedGanaderoId, generationsRemaining))
                .orElse(null);
    }

    @Transactional
    public BirthRegistrationResponse registerBirth(UUID motherUuid, BirthRegistrationRequest request, UUID currentUserId) {
        Animal mother = findByUuid(motherUuid, currentUserId);
        if (mother.getSex() != AnimalSex.HEMBRA) {
            throw new BusinessException(
                    "ANIMAL_BIRTH_MOTHER_SEX_INVALID",
                    "Sólo una hembra puede registrarse como madre de un parto.",
                    Response.Status.BAD_REQUEST);
        }

        Animal father = resolveBirthFather(request.fatherAnimalUuid(), mother.getOwnerGanadero().getId());
        List<Animal> offspring = request.offspring().stream()
                .map(offspringRequest -> createWithUuid(null, new AnimalRequest(
                        mother.getOwnerGanadero().getId(),
                        motherUuid,
                        father == null ? null : father.getUuid(),
                        offspringRequest.arete(),
                        offspringRequest.marca(),
                        offspringRequest.tatuaje(),
                        offspringRequest.category(),
                        offspringRequest.sex(),
                        offspringRequest.active(),
                        offspringRequest.admissionDate() == null ? request.birthDate() : offspringRequest.admissionDate(),
                        offspringRequest.weightKg(),
                        request.birthDate(),
                        null,
                        null,
                        null), currentUserId))
                .toList();

        var event = animalReproductionEventService.create(new AnimalReproductionEventRequest(
                motherUuid,
                bo.pasorapa.hato.domain.enumeration.AnimalReproductionEventType.BIRTH,
                request.birthDate().atStartOfDay().atOffset(ZoneOffset.UTC),
                request.notes(),
                currentUserId,
                "ONLINE",
                UUID.randomUUID(),
                birthMetadata(request, motherUuid, father, offspring),
                OffsetDateTime.now(ZoneOffset.UTC)), currentUserId);

        return new BirthRegistrationResponse(
                event.getEventId(),
                motherUuid,
                father == null ? null : father.getUuid(),
                request.birthDate(),
                offspring.size(),
                offspring.stream().map(animalMapper::toResponse).toList());
    }

    @Transactional
    public void applyAutoTransitionsOnRead(List<Animal> animals) {
        animals.forEach(this::applyAutoTransitionOnRead);
    }

    @Transactional
    public AnimalEvent applyCastration(AnimalEventRequest request, UUID authenticatedUserId) {
        AnimalEvent existing = animalEventLogRepository.findByOperationId(request.operationId())
                .map(animalEventMapper::toAnimalEvent)
                .orElse(null);
        if (existing != null) {
            return existing;
        }

        Animal animal = animalRepository.findByUuid(request.animalUuid())
                .orElseThrow(() -> new BusinessException("ANIMAL_NOT_FOUND", "No encontramos el animal solicitado.", Response.Status.NOT_FOUND));

        UUID effectivePerformedByUserId = resolvePerformedByUserId(request, authenticatedUserId);
        AnimalEvent event = animalEventMapper.toEntity(animal, request, effectivePerformedByUserId);
        AnimalEventLog eventLog = animalEventMapper.toAnimalEventLog(animal, request, effectivePerformedByUserId);
        animalEventLogRepository.persist(eventLog);
        animalEventLogRepository.flush();
        applyCastrationTransition(animal);
        animalRepository.flush();
        return animalEventMapper.toAnimalEvent(eventLog);
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
                request.motherAnimalUuid(),
                request.fatherAnimalUuid(),
                normalizedArete,
                normalizedMarca,
                normalizedTatuaje,
                request.category(),
                request.sex(),
                request.active(),
                request.admissionDate(),
                request.weightKg(),
                request.birthDate(),
                normalizeVisible(request.color()),
                request.description(),
                request.breedUuid());

        applyCategorySexValidation(normalizedRequest.category(), normalizedRequest.sex());
        validateBirthDateForYoungAnimals(normalizedRequest);
        validateParents(normalizedRequest, ownerGanadero.getId(), animal.getUuid());
        Raza breed = resolveActiveBreed(normalizedRequest.breedUuid());

        animalMapper.updateEntity(animal, normalizedRequest, ownerGanadero, breed);
        animal.setAreteNormalized(toNormalizedKey(normalizedArete));
        animal.setMarcaNormalized(toNormalizedKey(normalizedMarca));
        animal.setTatuajeNormalized(toNormalizedKey(normalizedTatuaje));
        animal.setCode(resolveLegacyCode(animal));
        animal.setTag(resolveLegacyTag(animal, normalizedArete));
    }

    private Raza resolveActiveBreed(UUID breedUuid) {
        if (breedUuid == null) {
            return null;
        }

        Raza breed = razaRepository.findByUuid(breedUuid)
                .orElseThrow(() -> new BusinessException(
                        "ANIMAL_BREED_NOT_ACTIVE",
                        "La raza seleccionada no está disponible.",
                        Response.Status.BAD_REQUEST));
        if (!Boolean.TRUE.equals(breed.getActivo())) {
            throw new BusinessException(
                    "ANIMAL_BREED_NOT_ACTIVE",
                    "La raza seleccionada no está disponible.",
                    Response.Status.BAD_REQUEST);
        }
        return breed;
    }

    public UUID resolveAuthenticatedGanaderoId(UUID currentUserId) {
        User currentUser = userRepository.findByIdOptional(currentUserId)
                .orElseThrow(() -> new BusinessException("USER_NOT_FOUND", "No encontramos el usuario autenticado.", Response.Status.NOT_FOUND));

        if (currentUser.getRole() != Role.GANADERO) {
            throw new BusinessException("ROLE_NOT_ALLOWED", "El rol autenticado no pertenece a un ganadero.", Response.Status.FORBIDDEN);
        }

        return ganaderoRepository.findByEmail(currentUser.getEmail())
                .orElseThrow(() -> new BusinessException("GANADERO_NOT_FOUND", "No encontramos el ganadero autenticado.", Response.Status.NOT_FOUND))
                .getId();
    }

    private void enforceAnimalOwnershipForCurrentUser(Animal animal, UUID currentUserId) {
        enforceAnimalOwnership(animal, resolveAllowedGanaderoId(currentUserId));
    }

    private UUID resolveAllowedGanaderoId(UUID currentUserId) {
        if (currentUserId == null) {
            return null;
        }

        User currentUser = userRepository.findByIdOptional(currentUserId)
                .orElseThrow(() -> new BusinessException("USER_NOT_FOUND", "No encontramos el usuario autenticado.", Response.Status.NOT_FOUND));

        if (currentUser.getRole() == Role.ADMIN) {
            return null;
        }

        if (currentUser.getRole() == Role.GANADERO) {
            return resolveAuthenticatedGanaderoId(currentUserId);
        }

        throw new BusinessException("ROLE_NOT_ALLOWED", "El rol autenticado no puede consultar animales.", Response.Status.FORBIDDEN);
    }

    private void enforceAnimalOwnership(Animal animal, UUID allowedGanaderoId) {
        if (allowedGanaderoId == null) {
            return;
        }

        if (!allowedGanaderoId.equals(animal.getOwnerGanadero().getId())) {
            throw new BusinessException(
                    "ANIMAL_OWNER_FORBIDDEN",
                    "El ganadero autenticado no puede consultar animales de otro propietario.",
                    Response.Status.FORBIDDEN);
        }
    }

    private boolean canExposeRelative(Animal animal, UUID allowedGanaderoId) {
        return allowedGanaderoId == null || allowedGanaderoId.equals(animal.getOwnerGanadero().getId());
    }

    private bo.pasorapa.hato.domain.Ganadero resolveOwner(UUID ownerGanaderoId, UUID currentUserId) {
        if (currentUserId == null) {
            return requireRequestedOwner(ownerGanaderoId);
        }

        User currentUser = userRepository.findByIdOptional(currentUserId)
                .orElseThrow(() -> new BusinessException("USER_NOT_FOUND", "No encontramos el usuario autenticado.", Response.Status.NOT_FOUND));

        if (currentUser.getRole() == Role.ADMIN) {
            return requireRequestedOwner(ownerGanaderoId);
        }

        if (currentUser.getRole() == Role.GANADERO) {
            UUID authenticatedGanaderoId = resolveAuthenticatedGanaderoId(currentUserId);
            bo.pasorapa.hato.domain.Ganadero authenticatedGanadero = ganaderoRepository.findByIdOptional(authenticatedGanaderoId)
                    .orElseThrow(() -> new BusinessException("GANADERO_NOT_FOUND", "No encontramos el ganadero autenticado.", Response.Status.NOT_FOUND));

            if (ownerGanaderoId != null && !authenticatedGanadero.getId().equals(ownerGanaderoId)) {
                throw new BusinessException(
                        "ANIMAL_OWNER_OVERRIDE_FORBIDDEN",
                        "El ganadero autenticado no puede asignar animales a otro propietario.",
                        Response.Status.FORBIDDEN);
            }

            return authenticatedGanadero;
        }

        throw new BusinessException("ROLE_NOT_ALLOWED", "El rol autenticado no puede administrar animales.", Response.Status.FORBIDDEN);
    }

    private bo.pasorapa.hato.domain.Ganadero requireRequestedOwner(UUID ownerGanaderoId) {
        if (ownerGanaderoId == null) {
            throw new BusinessException("ANIMAL_OWNER_GANADERO_ID_REQUIRED", "Necesitamos identificar al ganadero propietario.", Response.Status.BAD_REQUEST);
        }

        return ganaderoRepository.findByIdOptional(ownerGanaderoId)
                .orElseThrow(() -> new BusinessException("ANIMAL_OWNER_NOT_FOUND", "No encontramos el ganadero propietario indicado.", Response.Status.NOT_FOUND));
    }

    private Animal resolveBirthFather(UUID fatherAnimalUuid, UUID motherOwnerGanaderoId) {
        if (fatherAnimalUuid == null) {
            return null;
        }

        Animal father = animalRepository.findByUuid(fatherAnimalUuid)
                .orElseThrow(() -> new BusinessException("ANIMAL_BIRTH_FATHER_NOT_FOUND", "No encontramos el padre informado para el parto.", Response.Status.BAD_REQUEST));
        if (!motherOwnerGanaderoId.equals(father.getOwnerGanadero().getId())) {
            throw new BusinessException("ANIMAL_BIRTH_PARENT_OWNER_MISMATCH", "El padre debe pertenecer al mismo ganadero que la madre.", Response.Status.BAD_REQUEST);
        }
        if (father.getSex() != AnimalSex.MACHO) {
            throw new BusinessException("ANIMAL_BIRTH_FATHER_SEX_INVALID", "Sólo un macho puede registrarse como padre del parto.", Response.Status.BAD_REQUEST);
        }
        return father;
    }

    private Map<String, Object> birthMetadata(BirthRegistrationRequest request, UUID motherUuid, Animal father, List<Animal> offspring) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("birthDate", request.birthDate().atStartOfDay().atOffset(ZoneOffset.UTC).toString());
        metadata.put("offspringCount", offspring.size());
        metadata.put("motherAnimalUuid", motherUuid.toString());
        if (father != null) {
            metadata.put("fatherAnimalUuid", father.getUuid().toString());
        }
        metadata.put("offspringAnimalUuids", offspring.stream().map(animal -> animal.getUuid().toString()).toList());
        return metadata;
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

    private void validateParents(AnimalRequest request, UUID ownerGanaderoId, UUID currentAnimalUuid) {
        validateParent(request.motherAnimalUuid(), ownerGanaderoId, currentAnimalUuid, AnimalSex.HEMBRA, "ANIMAL_MOTHER_NOT_FOUND", "ANIMAL_MOTHER_SEX_INVALID");
        validateParent(request.fatherAnimalUuid(), ownerGanaderoId, currentAnimalUuid, AnimalSex.MACHO, "ANIMAL_FATHER_NOT_FOUND", "ANIMAL_FATHER_SEX_INVALID");
    }

    private void validateParent(
            UUID parentUuid,
            UUID ownerGanaderoId,
            UUID currentAnimalUuid,
            AnimalSex requiredSex,
            String notFoundCode,
            String invalidSexCode
    ) {
        if (parentUuid == null) {
            return;
        }

        if (currentAnimalUuid != null && currentAnimalUuid.equals(parentUuid)) {
            throw new BusinessException("ANIMAL_PARENT_SELF_REFERENCE", "Un animal no puede ser su propio progenitor.", Response.Status.BAD_REQUEST);
        }

        Animal parent = animalRepository.findByUuid(parentUuid)
                .orElseThrow(() -> new BusinessException(notFoundCode, "No encontramos el progenitor informado.", Response.Status.BAD_REQUEST));
        if (!ownerGanaderoId.equals(parent.getOwnerGanadero().getId())) {
            throw new BusinessException("ANIMAL_PARENT_OWNER_MISMATCH", "El progenitor debe pertenecer al mismo ganadero.", Response.Status.BAD_REQUEST);
        }
        if (parent.getSex() != requiredSex) {
            throw new BusinessException(invalidSexCode, "El sexo del progenitor no coincide con el rol informado.", Response.Status.BAD_REQUEST);
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

package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.AnimalEventLog;
import bo.pasorapa.hato.domain.AnimalReproductionEvent;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.enumeration.AnimalEventCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalReproductionEventType;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.AnimalEventLogRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.dto.animalreproductionevent.AnimalReproductionEventRequest;
import bo.pasorapa.hato.service.dto.animalreproductionevent.AnimalReproductionEventResponse;
import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.service.mapper.AnimalReproductionEventMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class AnimalReproductionEventService {

    private final AnimalEventLogRepository animalEventLogRepository;
    private final AnimalRepository animalRepository;
    private final AnimalReproductionEventMapper animalReproductionEventMapper;
    private final UserRepository userRepository;
    private final GanaderoRepository ganaderoRepository;

    public AnimalReproductionEventService(
            AnimalEventLogRepository animalEventLogRepository,
            AnimalRepository animalRepository,
            AnimalReproductionEventMapper animalReproductionEventMapper,
            UserRepository userRepository,
            GanaderoRepository ganaderoRepository) {
        this.animalEventLogRepository = animalEventLogRepository;
        this.animalRepository = animalRepository;
        this.animalReproductionEventMapper = animalReproductionEventMapper;
        this.userRepository = userRepository;
        this.ganaderoRepository = ganaderoRepository;
    }

    @Transactional
    public AnimalReproductionEvent create(AnimalReproductionEventRequest request) {
        return create(request, request.performedByUserId());
    }

    @Transactional
    public AnimalReproductionEvent create(AnimalReproductionEventRequest request, UUID authenticatedUserId) {
        AnimalEventLog existingLog = animalEventLogRepository.findByOperationId(request.operationId()).orElse(null);
        if (existingLog != null) {
            return animalReproductionEventMapper.toAnimalReproductionEvent(existingLog);
        }

        Animal animal = animalRepository.findByUuid(request.animalUuid())
                .orElseThrow(() -> new BusinessException("ANIMAL_NOT_FOUND", "No encontramos el animal solicitado.", Response.Status.NOT_FOUND));

        UUID effectivePerformedByUserId = resolvePerformedByUserId(request, authenticatedUserId);
        enforceAnimalOwnership(animal, authenticatedUserId);
        animalReproductionEventMapper.validateMetadata(request.reproductionEventType(), request.metadata());

        if (request.reproductionEventType() == AnimalReproductionEventType.SERVICE) {
            validateServiceEvent(animal, request.metadata());
        } else if (request.reproductionEventType() == AnimalReproductionEventType.PREGNANCY_DIAGNOSIS) {
            validatePregnancyDiagnosisEvent(animal, request.metadata());
        } else if (request.reproductionEventType() == AnimalReproductionEventType.BIRTH) {
            projectBirth(request.metadata());
        }

        AnimalEventLog eventLog = animalReproductionEventMapper.toAnimalEventLog(animal, request, effectivePerformedByUserId);
        animalEventLogRepository.persist(eventLog);
        animalEventLogRepository.flush();
        return animalReproductionEventMapper.toAnimalReproductionEvent(eventLog);
    }

    public List<AnimalReproductionEventResponse> list(
            UUID animalUuid,
            AnimalReproductionEventType reproductionEventType,
            OffsetDateTime occurredFrom,
            OffsetDateTime occurredTo) {
        return animalEventLogRepository
                .listReproductionHistory(
                        animalUuid,
                        reproductionEventType,
                        occurredFrom == null ? null : occurredFrom.toLocalDateTime(),
                        occurredTo == null ? null : occurredTo.toLocalDateTime())
                .stream()
                .map(animalReproductionEventMapper::toAnimalReproductionEvent)
                .map(animalReproductionEventMapper::toResponse)
                .toList();
    }

    public Map<String, Object> toPullItem(AnimalReproductionEvent event) {
        return animalReproductionEventMapper.toPullItem(event);
    }

    private UUID resolvePerformedByUserId(AnimalReproductionEventRequest request, UUID authenticatedUserId) {
        if (authenticatedUserId != null && request.performedByUserId() != null && !authenticatedUserId.equals(request.performedByUserId())) {
            throw new BusinessException(
                    "ANIMAL_REPRODUCTION_EVENT_PERFORMED_BY_MISMATCH",
                    "El actor reproductivo del payload no coincide con el usuario autenticado.",
                    Response.Status.BAD_REQUEST);
        }

        UUID effectiveUserId = authenticatedUserId != null ? authenticatedUserId : request.performedByUserId();
        if (effectiveUserId == null) {
            throw new BusinessException(
                    "ANIMAL_REPRODUCTION_EVENT_PERFORMED_BY_REQUIRED",
                    "Necesitamos identificar al usuario que registró el evento reproductivo.",
                    Response.Status.BAD_REQUEST);
        }
        return effectiveUserId;
    }

    private void enforceAnimalOwnership(Animal animal, UUID authenticatedUserId) {
        UUID allowedGanaderoId = resolveAllowedGanaderoId(authenticatedUserId);
        if (allowedGanaderoId != null && !allowedGanaderoId.equals(animal.getOwnerGanadero().getId())) {
            throw new BusinessException(
                    "ANIMAL_REPRODUCTION_EVENT_OWNER_FORBIDDEN",
                    "El ganadero autenticado no puede registrar eventos reproductivos para animales de otro propietario.",
                    Response.Status.FORBIDDEN);
        }
    }

    private UUID resolveAllowedGanaderoId(UUID authenticatedUserId) {
        if (authenticatedUserId == null) {
            return null;
        }

        User user = userRepository.findByIdOptional(authenticatedUserId)
                .orElseThrow(() -> new BusinessException("USER_NOT_FOUND", "No encontramos el usuario autenticado.", Response.Status.NOT_FOUND));
        if (user.getRole() == Role.ADMIN) {
            return null;
        }
        if (user.getRole() == Role.GANADERO) {
            return ganaderoRepository.findByEmail(user.getEmail())
                    .orElseThrow(() -> new BusinessException("GANADERO_NOT_FOUND", "No encontramos el ganadero autenticado.", Response.Status.NOT_FOUND))
                    .getId();
        }
        throw new BusinessException("ROLE_NOT_ALLOWED", "El rol autenticado no puede registrar eventos reproductivos.", Response.Status.FORBIDDEN);
    }

    private void projectBirth(Map<String, Object> metadata) {
        AnimalReproductionEventMapper.BirthMetadata birthMetadata = animalReproductionEventMapper.readBirthMetadata(metadata);

        animalRepository.findByUuid(birthMetadata.motherAnimalUuid())
                .orElseThrow(() -> new BusinessException(
                        "ANIMAL_REPRODUCTION_EVENT_MOTHER_NOT_FOUND",
                        "No encontramos la madre informada para el parto.",
                        Response.Status.NOT_FOUND));

        if (birthMetadata.fatherAnimalUuid() != null) {
            animalRepository.findByUuid(birthMetadata.fatherAnimalUuid())
                    .orElseThrow(() -> new BusinessException(
                            "ANIMAL_REPRODUCTION_EVENT_FATHER_NOT_FOUND",
                            "No encontramos el padre informado para el parto.",
                            Response.Status.NOT_FOUND));
        }

        for (UUID offspringAnimalUuid : birthMetadata.offspringAnimalUuids()) {
            Animal offspring = animalRepository.findByUuid(offspringAnimalUuid)
                    .orElseThrow(() -> new BusinessException(
                            "ANIMAL_REPRODUCTION_EVENT_OFFSPRING_NOT_FOUND",
                            "No encontramos una de las crías informadas para el parto.",
                            Response.Status.NOT_FOUND));
            validateParentageProjection(offspring, birthMetadata);
            offspring.setMotherAnimalUuid(birthMetadata.motherAnimalUuid());
            if (birthMetadata.fatherAnimalUuid() != null) {
                offspring.setFatherAnimalUuid(birthMetadata.fatherAnimalUuid());
            }
            offspring.setBirthDate(birthMetadata.birthDate());
        }
    }

    private void validateServiceEvent(Animal animal, Map<String, Object> metadata) {
        if (animal.getSex() != AnimalSex.HEMBRA) {
            throw new BusinessException(
                    "ANIMAL_REPRODUCTION_EVENT_FEMALE_REQUIRED",
                    "Sólo una hembra puede registrar un servicio reproductivo.",
                    Response.Status.BAD_REQUEST);
        }

        String serviceMethod = String.valueOf(metadata.get("serviceMethod"));
        if ("MONTA_NATURAL".equals(serviceMethod)) {
            validateNaturalMountSire(animal, metadata.get("fatherAnimalUuid"));
        }
    }

    private void validatePregnancyDiagnosisEvent(Animal animal, Map<String, Object> metadata) {
        if (animal.getSex() != AnimalSex.HEMBRA) {
            throw new BusinessException(
                    "ANIMAL_REPRODUCTION_EVENT_FEMALE_REQUIRED",
                    "Sólo una hembra puede registrar un diagnóstico de preñez.",
                    Response.Status.BAD_REQUEST);
        }

        UUID serviceEventUuid = readOptionalUuid(
                metadata.get("serviceEventUuid") != null ? metadata.get("serviceEventUuid") : metadata.get("relatedServiceEventId"),
                "ANIMAL_REPRODUCTION_EVENT_SERVICE_REFERENCE_INVALID");
        if (serviceEventUuid == null) {
            return;
        }

        AnimalReproductionEvent serviceEvent = animalEventLogRepository.findByEventIdOrOperationId(AnimalEventCategory.REPRODUCTION, serviceEventUuid)
                .map(animalReproductionEventMapper::toAnimalReproductionEvent)
                .orElseThrow(() -> new BusinessException(
                        "ANIMAL_REPRODUCTION_EVENT_SERVICE_REFERENCE_NOT_FOUND",
                        "No encontramos el servicio reproductivo asociado al diagnóstico.",
                        Response.Status.BAD_REQUEST));
        if (serviceEvent.getReproductionEventType() != AnimalReproductionEventType.SERVICE) {
            throw new BusinessException(
                    "ANIMAL_REPRODUCTION_EVENT_SERVICE_REFERENCE_TYPE_INVALID",
                    "El evento asociado al diagnóstico debe ser un servicio reproductivo.",
                    Response.Status.BAD_REQUEST);
        }
        if (!animal.getUuid().equals(serviceEvent.getAnimal().getUuid())) {
            throw new BusinessException(
                    "ANIMAL_REPRODUCTION_EVENT_SERVICE_REFERENCE_ANIMAL_MISMATCH",
                    "El servicio reproductivo asociado debe pertenecer al mismo animal.",
                    Response.Status.BAD_REQUEST);
        }
        if (!animal.getOwnerGanadero().getId().equals(serviceEvent.getAnimal().getOwnerGanadero().getId())) {
            throw new BusinessException(
                    "ANIMAL_REPRODUCTION_EVENT_SERVICE_REFERENCE_OWNER_MISMATCH",
                    "El servicio reproductivo asociado debe pertenecer al mismo ganadero.",
                    Response.Status.BAD_REQUEST);
        }
    }

    private void validateNaturalMountSire(Animal femaleAnimal, Object rawFatherAnimalUuid) {
        UUID fatherAnimalUuid = readRequiredUuid(rawFatherAnimalUuid, "ANIMAL_REPRODUCTION_EVENT_SERVICE_SIRE_REQUIRED");
        Animal sire = animalRepository.findByUuid(fatherAnimalUuid)
                .orElseThrow(() -> new BusinessException(
                        "ANIMAL_REPRODUCTION_EVENT_SERVICE_SIRE_NOT_FOUND",
                        "No encontramos el toro/padre informado para la monta natural.",
                        Response.Status.BAD_REQUEST));
        if (!femaleAnimal.getOwnerGanadero().getId().equals(sire.getOwnerGanadero().getId())) {
            throw new BusinessException(
                    "ANIMAL_REPRODUCTION_EVENT_SERVICE_SIRE_OWNER_MISMATCH",
                    "El toro/padre debe pertenecer al mismo ganadero que la hembra.",
                    Response.Status.BAD_REQUEST);
        }
        if (sire.getSex() != AnimalSex.MACHO) {
            throw new BusinessException(
                    "ANIMAL_REPRODUCTION_EVENT_SERVICE_SIRE_SEX_INVALID",
                    "Sólo un macho puede registrarse como toro/padre de la monta natural.",
                    Response.Status.BAD_REQUEST);
        }
    }

    private UUID readRequiredUuid(Object value, String errorCode) {
        UUID uuid = readOptionalUuid(value, errorCode);
        if (uuid == null) {
            throw new BusinessException(errorCode, "Necesitamos identificar el toro/padre de la monta natural.", Response.Status.BAD_REQUEST);
        }
        return uuid;
    }

    private UUID readOptionalUuid(Object value, String errorCode) {
        if (value == null) {
            return null;
        }
        if (!(value instanceof String text) || text.isBlank()) {
            throw new BusinessException(errorCode, "El identificador informado no es válido.", Response.Status.BAD_REQUEST);
        }
        try {
            return UUID.fromString(text);
        } catch (IllegalArgumentException exception) {
            throw new BusinessException(errorCode, "El identificador informado no es válido.", Response.Status.BAD_REQUEST);
        }
    }

    private void validateParentageProjection(Animal offspring, AnimalReproductionEventMapper.BirthMetadata birthMetadata) {
        if (offspring.getMotherAnimalUuid() != null && !offspring.getMotherAnimalUuid().equals(birthMetadata.motherAnimalUuid())) {
            throw new BusinessException(
                    "ANIMAL_REPRODUCTION_EVENT_PARENTAGE_CONFLICT",
                    "La cría ya tiene una madre distinta cargada y no podemos sobrescribirla en V1.",
                    Response.Status.CONFLICT);
        }

        if (birthMetadata.fatherAnimalUuid() != null
                && offspring.getFatherAnimalUuid() != null
                && !offspring.getFatherAnimalUuid().equals(birthMetadata.fatherAnimalUuid())) {
            throw new BusinessException(
                    "ANIMAL_REPRODUCTION_EVENT_PARENTAGE_CONFLICT",
                    "La cría ya tiene un padre distinto cargado y no podemos sobrescribirlo en V1.",
                    Response.Status.CONFLICT);
        }

        if (offspring.getBirthDate() != null && !offspring.getBirthDate().equals(birthMetadata.birthDate())) {
            throw new BusinessException(
                    "ANIMAL_REPRODUCTION_EVENT_PARENTAGE_CONFLICT",
                    "La cría ya tiene fecha de nacimiento registrada y no podemos sobrescribirla en V1.",
                    Response.Status.CONFLICT);
        }
    }
}

package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.AnimalReproductionEvent;
import bo.pasorapa.hato.domain.enumeration.AnimalReproductionEventType;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.AnimalReproductionEventRepository;
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

    private final AnimalReproductionEventRepository animalReproductionEventRepository;
    private final AnimalRepository animalRepository;
    private final AnimalReproductionEventMapper animalReproductionEventMapper;

    public AnimalReproductionEventService(
            AnimalReproductionEventRepository animalReproductionEventRepository,
            AnimalRepository animalRepository,
            AnimalReproductionEventMapper animalReproductionEventMapper) {
        this.animalReproductionEventRepository = animalReproductionEventRepository;
        this.animalRepository = animalRepository;
        this.animalReproductionEventMapper = animalReproductionEventMapper;
    }

    @Transactional
    public AnimalReproductionEvent create(AnimalReproductionEventRequest request) {
        return create(request, request.performedByUserId());
    }

    @Transactional
    public AnimalReproductionEvent create(AnimalReproductionEventRequest request, UUID authenticatedUserId) {
        AnimalReproductionEvent existing = animalReproductionEventRepository.findByOperationId(request.operationId()).orElse(null);
        if (existing != null) {
            return existing;
        }

        Animal animal = animalRepository.findByUuid(request.animalUuid())
                .orElseThrow(() -> new BusinessException("ANIMAL_NOT_FOUND", "No encontramos el animal solicitado.", Response.Status.NOT_FOUND));

        UUID effectivePerformedByUserId = resolvePerformedByUserId(request, authenticatedUserId);
        animalReproductionEventMapper.validateMetadata(request.reproductionEventType(), request.metadata());

        if (request.reproductionEventType() == AnimalReproductionEventType.BIRTH) {
            projectBirth(request.metadata());
        }

        AnimalReproductionEvent event = animalReproductionEventMapper.toEntity(animal, request, effectivePerformedByUserId);
        animalReproductionEventRepository.persist(event);
        animalReproductionEventRepository.flush();
        return event;
    }

    public List<AnimalReproductionEventResponse> list(
            UUID animalUuid,
            AnimalReproductionEventType reproductionEventType,
            OffsetDateTime occurredFrom,
            OffsetDateTime occurredTo) {
        return animalReproductionEventRepository
                .listHistory(
                        animalUuid,
                        reproductionEventType,
                        occurredFrom == null ? null : occurredFrom.toLocalDateTime(),
                        occurredTo == null ? null : occurredTo.toLocalDateTime())
                .stream()
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

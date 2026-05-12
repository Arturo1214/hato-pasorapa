package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.AnimalEvent;
import bo.pasorapa.hato.domain.AnimalEventLog;
import bo.pasorapa.hato.domain.enumeration.AnimalEventType;
import bo.pasorapa.hato.repository.AnimalEventRepository;
import bo.pasorapa.hato.repository.AnimalEventLogRepository;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.service.dto.animalevent.AnimalEventRequest;
import bo.pasorapa.hato.service.dto.animalevent.AnimalEventResponse;
import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.service.mapper.AnimalEventMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class AnimalEventService {

    private final AnimalEventRepository animalEventRepository;
    private final AnimalEventLogRepository animalEventLogRepository;
    private final AnimalRepository animalRepository;
    private final GanaderoRepository ganaderoRepository;
    private final AnimalEventMapper animalEventMapper;
    private final AnimalService animalService;

    public AnimalEventService(
            AnimalEventRepository animalEventRepository,
            AnimalEventLogRepository animalEventLogRepository,
            AnimalRepository animalRepository,
            GanaderoRepository ganaderoRepository,
            AnimalEventMapper animalEventMapper,
            AnimalService animalService) {
        this.animalEventRepository = animalEventRepository;
        this.animalEventLogRepository = animalEventLogRepository;
        this.animalRepository = animalRepository;
        this.ganaderoRepository = ganaderoRepository;
        this.animalEventMapper = animalEventMapper;
        this.animalService = animalService;
    }

    @Transactional
    public AnimalEvent create(AnimalEventRequest request) {
        return create(request, request.performedByUserId());
    }

    @Transactional
    public AnimalEvent create(AnimalEventRequest request, UUID authenticatedUserId) {
        if (request.type() == AnimalEventType.CASTRATION) {
            return animalService.applyCastration(request, authenticatedUserId);
        }

        AnimalEventLog existingLog = animalEventLogRepository.findByOperationId(request.operationId()).orElse(null);
        if (existingLog != null) {
            return animalEventMapper.toAnimalEvent(existingLog);
        }

        AnimalEvent existing = animalEventRepository.findByOperationId(request.operationId()).orElse(null);
        if (existing != null) {
            return existing;
        }

        Animal animal = animalRepository.findByUuid(request.animalUuid())
                .orElseThrow(() -> new BusinessException("ANIMAL_NOT_FOUND", "No encontramos el animal solicitado.", Response.Status.NOT_FOUND));

        UUID effectivePerformedByUserId = resolvePerformedByUserId(request, authenticatedUserId);
        validateOwnershipReferences(request.type(), request.metadata());

        AnimalEventLog eventLog = animalEventMapper.toAnimalEventLog(animal, request, effectivePerformedByUserId);
        animalEventLogRepository.persist(eventLog);
        animalEventLogRepository.flush();
        replayProjection(animal.getUuid());
        animalRepository.flush();
        return animalEventMapper.toAnimalEvent(eventLog);
    }

    public List<AnimalEventResponse> list(UUID animalUuid, AnimalEventType eventType, OffsetDateTime occurredFrom, OffsetDateTime occurredTo) {
        return animalEventLogRepository
                .listGeneralHistory(
                        animalUuid,
                        eventType,
                        occurredFrom == null ? null : occurredFrom.toLocalDateTime(),
                        occurredTo == null ? null : occurredTo.toLocalDateTime())
                .stream()
                .map(animalEventMapper::toAnimalEvent)
                .collect(java.util.stream.Collectors.collectingAndThen(
                        java.util.stream.Collectors.toCollection(java.util.ArrayList::new),
                        unifiedEvents -> {
                            unifiedEvents.addAll(animalEventRepository.listHistory(
                                    animalUuid,
                                    eventType,
                                    occurredFrom == null ? null : occurredFrom.toLocalDateTime(),
                                    occurredTo == null ? null : occurredTo.toLocalDateTime()));
                            return unifiedEvents.stream()
                                    .collect(java.util.stream.Collectors.toMap(
                                            AnimalEvent::getOperationId,
                                            event -> event,
                                            (left, right) -> left,
                                            java.util.LinkedHashMap::new))
                                    .values()
                                    .stream()
                                    .sorted(java.util.Comparator.comparing(AnimalEvent::getOccurredAt)
                                            .thenComparing(AnimalEvent::getCreatedAt)
                                            .thenComparing(AnimalEvent::getEventId))
                                    .map(animalEventMapper::toResponse)
                                    .toList();
                        }));
    }

    public Map<String, Object> toPullItem(AnimalEvent event) {
        return animalEventMapper.toPullItem(event);
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

    private void replayProjection(UUID animalUuid) {
        Animal animal = animalRepository.findByUuid(animalUuid)
                .orElseThrow(() -> new BusinessException("ANIMAL_NOT_FOUND", "No encontramos el animal solicitado.", Response.Status.NOT_FOUND));
        List<AnimalEvent> orderedEvents = animalEventLogRepository.findGeneralByAnimalUuidForProjection(animalUuid)
                .stream()
                .map(animalEventMapper::toAnimalEvent)
                .toList();
        orderedEvents.forEach(event -> applyProjection(animal, event));
    }

    private void applyProjection(Animal animal, AnimalEvent event) {
        switch (event.getType()) {
            case SOLD, DECEASED, LOST -> animal.setActive(false);
            case TRANSFERRED -> {
                UUID targetOwnerId = readUuid(event, "toOwnerGanaderoId", "ANIMAL_EVENT_TRANSFER_TO_OWNER_REQUIRED");
                animal.setOwnerGanadero(ganaderoRepository.findByIdOptional(targetOwnerId)
                        .orElseThrow(() -> new BusinessException(
                                "ANIMAL_EVENT_TRANSFER_OWNER_NOT_FOUND",
                                "No encontramos el ganadero destino para la transferencia.",
                                Response.Status.BAD_REQUEST)));
            }
            case CASTRATION -> {
                if (animal.getCategory() == bo.pasorapa.hato.domain.enumeration.AnimalCategory.TERNERO
                        || animal.getCategory() == bo.pasorapa.hato.domain.enumeration.AnimalCategory.TORO) {
                    animal.setCategory(bo.pasorapa.hato.domain.enumeration.AnimalCategory.BUEY);
                }
            }
            case OBSERVATION -> {
                // No core mutation in V1.
            }
        }
    }

    private void validateOwnershipReferences(AnimalEventType type, Map<String, Object> metadata) {
        if (type != AnimalEventType.TRANSFERRED) {
            return;
        }
        readUuid(metadata, "fromOwnerGanaderoId", "ANIMAL_EVENT_TRANSFER_FROM_OWNER_REQUIRED");
        readUuid(metadata, "toOwnerGanaderoId", "ANIMAL_EVENT_TRANSFER_TO_OWNER_REQUIRED");
    }

    private UUID readUuid(AnimalEvent event, String field, String errorCode) {
        return readUuid(animalEventMapper.readMetadataJson(event.getMetadataJson()), field, errorCode);
    }

    private UUID readUuid(Map<String, Object> metadata, String field, String errorCode) {
        Object rawValue = metadata.get(field);
        if (!(rawValue instanceof String text) || text.isBlank()) {
            throw new BusinessException(errorCode, "Falta metadata obligatoria del evento animal.", Response.Status.BAD_REQUEST);
        }
        try {
            return UUID.fromString(text);
        } catch (IllegalArgumentException exception) {
            throw new BusinessException(errorCode, "El UUID de metadata del evento animal es inválido.", Response.Status.BAD_REQUEST);
        }
    }
}

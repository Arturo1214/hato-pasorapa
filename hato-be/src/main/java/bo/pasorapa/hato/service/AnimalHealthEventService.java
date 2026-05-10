package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.AnimalHealthEvent;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.enumeration.AnimalHealthEventType;
import bo.pasorapa.hato.repository.AnimalHealthEventRepository;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.dto.animalhealthevent.AnimalHealthEventRequest;
import bo.pasorapa.hato.service.dto.animalhealthevent.AnimalHealthEventResponse;
import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.service.mapper.AnimalHealthEventMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class AnimalHealthEventService {

    private final AnimalHealthEventRepository animalHealthEventRepository;
    private final AnimalRepository animalRepository;
    private final UserRepository userRepository;
    private final GanaderoRepository ganaderoRepository;
    private final AnimalHealthEventMapper animalHealthEventMapper;

    public AnimalHealthEventService(
            AnimalHealthEventRepository animalHealthEventRepository,
            AnimalRepository animalRepository,
            UserRepository userRepository,
            GanaderoRepository ganaderoRepository,
            AnimalHealthEventMapper animalHealthEventMapper) {
        this.animalHealthEventRepository = animalHealthEventRepository;
        this.animalRepository = animalRepository;
        this.userRepository = userRepository;
        this.ganaderoRepository = ganaderoRepository;
        this.animalHealthEventMapper = animalHealthEventMapper;
    }

    @Transactional
    public AnimalHealthEvent create(AnimalHealthEventRequest request) {
        return create(request, request.performedByUserId());
    }

    @Transactional
    public AnimalHealthEvent create(AnimalHealthEventRequest request, UUID authenticatedUserId) {
        AnimalHealthEvent existing = animalHealthEventRepository.findByOperationId(request.operationId()).orElse(null);
        if (existing != null) {
            return existing;
        }

        Animal animal = animalRepository.findByUuid(request.animalUuid())
                .orElseThrow(() -> new BusinessException("ANIMAL_NOT_FOUND", "No encontramos el animal solicitado.", Response.Status.NOT_FOUND));

        UUID effectivePerformedByUserId = resolvePerformedByUserId(request, authenticatedUserId);
        animalHealthEventMapper.validateMetadata(request.healthEventType(), request.metadata(), request.notes());
        validateTreatmentContinuity(request.animalUuid(), request.healthEventType(), request.metadata());
        validateFieldVetVisitContinuity(request.animalUuid(), request.healthEventType(), request.metadata());
        validateNextDueAt(request.healthEventType(), request.occurredAt(), request.metadata());

        AnimalHealthEvent event = animalHealthEventMapper.toEntity(animal, request, effectivePerformedByUserId);
        animalHealthEventRepository.persist(event);
        animalHealthEventRepository.flush();
        return event;
    }

    public List<AnimalHealthEventResponse> list(
            UUID animalUuid,
            AnimalHealthEventType healthEventType,
            OffsetDateTime occurredFrom,
            OffsetDateTime occurredTo,
            String visitId) {
        return list(animalUuid, healthEventType, occurredFrom, occurredTo, visitId, null, false);
    }

    public List<AnimalHealthEventResponse> list(
            UUID animalUuid,
            AnimalHealthEventType healthEventType,
            OffsetDateTime occurredFrom,
            OffsetDateTime occurredTo,
            String visitId,
            UUID currentUserId,
            boolean ganaderoScoped) {
        if (ganaderoScoped) {
            requireAnimalOwnedByAuthenticatedGanadero(animalUuid, currentUserId);
        }

        List<AnimalHealthEvent> timeline = animalHealthEventRepository.listHistory(
                animalUuid,
                healthEventType,
                occurredFrom == null ? null : occurredFrom.toLocalDateTime(),
                occurredTo == null ? null : occurredTo.toLocalDateTime(),
                visitId);

        Map<String, FollowUpProjection> projections = buildFollowUpProjections(timeline);
        return timeline.stream()
                .map(event -> {
                    Map<String, Object> metadata = animalHealthEventMapper.readMetadataJson(event.getMetadataJson());
                    FollowUpProjection projection = resolveFollowUpProjection(event.getHealthEventType(), metadata, projections);
                    return animalHealthEventMapper.toResponse(
                            event,
                            animalHealthEventMapper.readVisitId(metadata),
                            projection == null ? null : projection.status(),
                            projection == null ? animalHealthEventMapper.readNextDueAt(metadata) : projection.nextDueAt());
                })
                .toList();
    }

    private void requireAnimalOwnedByAuthenticatedGanadero(UUID animalUuid, UUID currentUserId) {
        Animal animal = animalRepository.findByUuid(animalUuid)
                .orElseThrow(() -> new BusinessException("ANIMAL_NOT_FOUND", "No encontramos el animal solicitado.", Response.Status.NOT_FOUND));
        User currentUser = userRepository.findByIdOptional(currentUserId)
                .orElseThrow(() -> new BusinessException("USER_NOT_FOUND", "No encontramos el usuario autenticado.", Response.Status.NOT_FOUND));
        if (currentUser.getRole() != Role.GANADERO) {
            throw new BusinessException("ROLE_NOT_ALLOWED", "El rol autenticado no pertenece a un ganadero.", Response.Status.FORBIDDEN);
        }

        UUID authenticatedGanaderoId = ganaderoRepository.findByEmail(currentUser.getEmail())
                .orElseThrow(() -> new BusinessException("GANADERO_NOT_FOUND", "No encontramos el ganadero autenticado.", Response.Status.NOT_FOUND))
                .getId();
        if (!authenticatedGanaderoId.equals(animal.getOwnerGanadero().getId())) {
            throw new BusinessException("ANIMAL_NOT_FOUND", "No encontramos el animal solicitado.", Response.Status.NOT_FOUND);
        }
    }

    public Map<String, Object> toPullItem(AnimalHealthEvent event) {
        return animalHealthEventMapper.toPullItem(event);
    }

    private UUID resolvePerformedByUserId(AnimalHealthEventRequest request, UUID authenticatedUserId) {
        if (authenticatedUserId != null && request.performedByUserId() != null && !authenticatedUserId.equals(request.performedByUserId())) {
            throw new BusinessException(
                    "ANIMAL_HEALTH_EVENT_PERFORMED_BY_MISMATCH",
                    "El actor sanitario del payload no coincide con el usuario autenticado.",
                    Response.Status.BAD_REQUEST);
        }

        UUID effectiveUserId = authenticatedUserId != null ? authenticatedUserId : request.performedByUserId();
        if (effectiveUserId == null) {
            throw new BusinessException(
                    "ANIMAL_HEALTH_EVENT_PERFORMED_BY_REQUIRED",
                    "Necesitamos identificar al usuario que realizó el evento sanitario.",
                    Response.Status.BAD_REQUEST);
        }
        return effectiveUserId;
    }

    private void validateTreatmentContinuity(UUID animalUuid, AnimalHealthEventType healthEventType, Map<String, Object> metadata) {
        if (!isTreatmentEvent(healthEventType)) {
            return;
        }

        String treatmentCaseId = animalHealthEventMapper.readTreatmentCaseId(metadata);
        List<AnimalHealthEvent> timeline = animalHealthEventRepository.listByTreatmentCase(animalUuid, treatmentCaseId);
        boolean hasStarted = timeline.stream().anyMatch(event -> event.getHealthEventType() == AnimalHealthEventType.TREATMENT_STARTED);
        boolean hasClosed = timeline.stream().anyMatch(event -> event.getHealthEventType() == AnimalHealthEventType.TREATMENT_CLOSED);

        switch (healthEventType) {
            case TREATMENT_STARTED -> {
                if (hasStarted && !hasClosed) {
                    throw new BusinessException(
                            "ANIMAL_HEALTH_EVENT_TREATMENT_CASE_ALREADY_OPEN",
                            "Ya existe un tratamiento activo para ese treatmentCaseId.",
                            Response.Status.BAD_REQUEST);
                }
            }
            case TREATMENT_FOLLOW_UP -> {
                if (!hasStarted) {
                    throw new BusinessException(
                            "ANIMAL_HEALTH_EVENT_TREATMENT_CASE_NOT_FOUND",
                            "No existe un tratamiento iniciado para ese treatmentCaseId.",
                            Response.Status.BAD_REQUEST);
                }
                if (hasClosed) {
                    throw new BusinessException(
                            "ANIMAL_HEALTH_EVENT_TREATMENT_CASE_CLOSED",
                            "Ese tratamiento ya fue cerrado y no admite seguimiento adicional.",
                            Response.Status.BAD_REQUEST);
                }
            }
            case TREATMENT_CLOSED -> {
                if (!hasStarted) {
                    throw new BusinessException(
                            "ANIMAL_HEALTH_EVENT_TREATMENT_CASE_NOT_FOUND",
                            "No existe un tratamiento iniciado para ese treatmentCaseId.",
                            Response.Status.BAD_REQUEST);
                }
                if (hasClosed) {
                    throw new BusinessException(
                            "ANIMAL_HEALTH_EVENT_TREATMENT_CASE_CLOSED",
                            "Ese tratamiento ya fue cerrado.",
                            Response.Status.BAD_REQUEST);
                }
            }
            default -> {
            }
        }
    }

    private void validateFieldVetVisitContinuity(UUID animalUuid, AnimalHealthEventType healthEventType, Map<String, Object> metadata) {
        if (healthEventType != AnimalHealthEventType.FIELD_VET_VISIT) {
            return;
        }

        String visitId = animalHealthEventMapper.readVisitId(metadata);
        String protocolStatus = animalHealthEventMapper.readFieldVetProtocolStatus(metadata);
        List<AnimalHealthEvent> timeline = animalHealthEventRepository.listByVisit(animalUuid, visitId, null, null);
        boolean hasStarted = timeline.stream().anyMatch(event -> hasFieldVetStatus(event, "STARTED") || hasFieldVetStatus(event, "FOLLOW_UP_REQUIRED"));
        boolean hasClosed = timeline.stream().anyMatch(event -> hasFieldVetStatus(event, "CLOSED"));

        if ("STARTED".equals(protocolStatus) && hasStarted && !hasClosed) {
            throw new BusinessException(
                    "ANIMAL_HEALTH_EVENT_VET_VISIT_ALREADY_OPEN",
                    "Ya existe una visita veterinaria abierta para ese visitId.",
                    Response.Status.BAD_REQUEST);
        }

        if ("FOLLOW_UP_REQUIRED".equals(protocolStatus) || "CLOSED".equals(protocolStatus)) {
            if (!hasStarted) {
                throw new BusinessException(
                        "ANIMAL_HEALTH_EVENT_VET_VISIT_NOT_FOUND",
                        "No existe una visita veterinaria iniciada para ese visitId.",
                        Response.Status.BAD_REQUEST);
            }
            if (hasClosed) {
                throw new BusinessException(
                        "ANIMAL_HEALTH_EVENT_VET_VISIT_CLOSED",
                        "Esa visita veterinaria ya fue cerrada.",
                        Response.Status.BAD_REQUEST);
            }
        }
    }

    private void validateNextDueAt(AnimalHealthEventType healthEventType, OffsetDateTime occurredAt, Map<String, Object> metadata) {
        OffsetDateTime nextDueAt = animalHealthEventMapper.readNextDueAt(metadata);
        if (nextDueAt != null && nextDueAt.isBefore(occurredAt)) {
            throw new BusinessException(
                    healthEventType == AnimalHealthEventType.FIELD_VET_VISIT
                            ? "ANIMAL_HEALTH_EVENT_VET_PROTOCOL_NEXT_DUE_AT_BEFORE_OCCURRED_AT"
                            : "ANIMAL_HEALTH_EVENT_NEXT_DUE_AT_BEFORE_OCCURRED_AT",
                    "El próximo control no puede quedar antes de la ocurrencia del evento.",
                    Response.Status.BAD_REQUEST);
        }
    }

    private boolean isTreatmentEvent(AnimalHealthEventType healthEventType) {
        return healthEventType == AnimalHealthEventType.TREATMENT_STARTED
                || healthEventType == AnimalHealthEventType.TREATMENT_FOLLOW_UP
                || healthEventType == AnimalHealthEventType.TREATMENT_CLOSED;
    }

    private boolean hasFieldVetStatus(AnimalHealthEvent event, String expectedStatus) {
        Map<String, Object> metadata = animalHealthEventMapper.readMetadataJson(event.getMetadataJson());
        return expectedStatus.equals(animalHealthEventMapper.readFieldVetProtocolStatus(metadata));
    }

    private Map<String, FollowUpProjection> buildFollowUpProjections(List<AnimalHealthEvent> timeline) {
        Map<String, FollowUpProjection> projections = new LinkedHashMap<>();
        for (AnimalHealthEvent event : timeline) {
            Map<String, Object> metadata = animalHealthEventMapper.readMetadataJson(event.getMetadataJson());
            String threadKey = readFollowUpThreadKey(event.getHealthEventType(), metadata);
            if (threadKey == null) {
                continue;
            }
            projections.put(threadKey, mapFollowUpProjection(event.getHealthEventType(), metadata));
        }
        return projections;
    }

    private FollowUpProjection resolveFollowUpProjection(
            AnimalHealthEventType healthEventType,
            Map<String, Object> metadata,
            Map<String, FollowUpProjection> projections) {
        String threadKey = readFollowUpThreadKey(healthEventType, metadata);
        if (threadKey == null) {
            return null;
        }
        return projections.get(threadKey);
    }

    private String readFollowUpThreadKey(AnimalHealthEventType type, Map<String, Object> metadata) {
        if (type == AnimalHealthEventType.FIELD_VET_VISIT) {
            String visitId = animalHealthEventMapper.readVisitId(metadata);
            return visitId == null ? null : "visit:" + visitId;
        }
        if (isTreatmentEvent(type)) {
            String treatmentCaseId = animalHealthEventMapper.readTreatmentCaseId(metadata);
            return treatmentCaseId == null ? null : "treatment:" + treatmentCaseId;
        }
        return null;
    }

    private FollowUpProjection mapFollowUpProjection(AnimalHealthEventType type, Map<String, Object> metadata) {
        if (type == AnimalHealthEventType.FIELD_VET_VISIT) {
            String protocolStatus = animalHealthEventMapper.readFieldVetProtocolStatus(metadata);
            return new FollowUpProjection(
                    "CLOSED".equals(protocolStatus) ? "CLOSED" : "ACTIVE",
                    animalHealthEventMapper.readNextDueAt(metadata));
        }
        if (type == AnimalHealthEventType.TREATMENT_CLOSED) {
            return new FollowUpProjection("CLOSED", animalHealthEventMapper.readNextDueAt(metadata));
        }
        return new FollowUpProjection("ACTIVE", animalHealthEventMapper.readNextDueAt(metadata));
    }

    private record FollowUpProjection(String status, OffsetDateTime nextDueAt) {
    }
}

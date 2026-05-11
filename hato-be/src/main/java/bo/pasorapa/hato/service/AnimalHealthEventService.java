package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.AnimalHealthEvent;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.enumeration.AnimalHealthEventType;
import bo.pasorapa.hato.repository.AnimalHealthEventRepository;
import bo.pasorapa.hato.repository.AnimalHealthEventRepository.VetVisitQuery;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.dto.animalhealthevent.AnimalHealthEventRequest;
import bo.pasorapa.hato.service.dto.animalhealthevent.AnimalHealthEventResponse;
import bo.pasorapa.hato.service.dto.vetvisit.VetVisitFilterDto;
import bo.pasorapa.hato.service.dto.vetvisit.VetVisitItemDto;
import bo.pasorapa.hato.service.dto.vetvisit.VetVisitListResponse;
import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.service.mapper.AnimalHealthEventMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
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

    public VetVisitListResponse listVetVisits(VetVisitFilterDto filter, UUID currentUserId, boolean ganaderoScoped) {
        UUID ownerId = ganaderoScoped ? resolveAuthenticatedGanaderoId(currentUserId) : null;
        if (ownerId != null) {
            return getGlobalVisitsByOwner(ownerId, filter);
        }
        return getGlobalVisitsByOwner(null, filter);
    }

    public VetVisitListResponse getGlobalVisitsByOwner(UUID ownerId, VetVisitFilterDto filter) {
        VetVisitQuery query = new VetVisitQuery(
                filter.animalUuid,
                filter.normalizedVisitId(),
                filter.normalizedMode(),
                null,
                filter.occurredFrom == null ? null : filter.occurredFrom.toLocalDateTime(),
                filter.occurredTo == null ? null : filter.occurredTo.toLocalDateTime(),
                Integer.MAX_VALUE,
                0);
        List<VetVisitItemDto> groupedItems = groupVetVisits(animalHealthEventRepository.findFieldVetVisitsByOwner(ownerId, query).items()).stream()
                .filter(item -> filter.normalizedStatus() == null || filter.normalizedStatus().equalsIgnoreCase(item.status()))
                .toList();
        int fromIndex = Math.min(filter.offset(), groupedItems.size());
        int toIndex = Math.min(fromIndex + filter.size, groupedItems.size());
        return new VetVisitListResponse(groupedItems.subList(fromIndex, toIndex), filter.page, filter.size, groupedItems.size());
    }

    public List<VetVisitItemDto> getVisitChainDetail(String visitId, UUID currentUserId, boolean ganaderoScoped) {
        UUID ownerId = ganaderoScoped ? resolveAuthenticatedGanaderoId(currentUserId) : null;
        List<AnimalHealthEvent> selectedEvents = filterEventsByOwner(animalHealthEventRepository.findByVisitId(visitId), ownerId);
        if (selectedEvents.isEmpty()) {
            return List.of();
        }

        AnimalHealthEvent selected = selectedEvents.stream()
                .max(vetVisitLifecycleComparator())
                .orElseThrow();
        Map<String, Object> selectedMetadata = animalHealthEventMapper.readMetadataJson(selected.getMetadataJson());
        String rootVisitId = readText(readVisit(selectedMetadata).get("parentVisitId"));
        if (rootVisitId == null) {
            rootVisitId = visitId;
        }

        List<AnimalHealthEvent> chainEvents = new ArrayList<>();
        chainEvents.addAll(filterEventsByOwner(animalHealthEventRepository.findByVisitId(rootVisitId), ownerId));
        chainEvents.addAll(filterEventsByOwner(animalHealthEventRepository.findByParentVisitId(rootVisitId), ownerId));

        return groupVetVisitItems(chainEvents).stream()
                .sorted(Comparator.comparing((VetVisitItemDto item) -> item.parentVisitId() == null ? 0 : 1)
                        .thenComparing(VetVisitItemDto::occurredAt, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(VetVisitItemDto::visitId, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    private List<AnimalHealthEvent> filterEventsByOwner(List<AnimalHealthEvent> events, UUID ownerId) {
        if (ownerId == null) {
            return events;
        }
        return events.stream()
                .filter(event -> event.getAnimal() != null
                        && event.getAnimal().getOwnerGanadero() != null
                        && ownerId.equals(event.getAnimal().getOwnerGanadero().getId()))
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

    private UUID resolveAuthenticatedGanaderoId(UUID currentUserId) {
        User currentUser = userRepository.findByIdOptional(currentUserId)
                .orElseThrow(() -> new BusinessException("USER_NOT_FOUND", "No encontramos el usuario autenticado.", Response.Status.NOT_FOUND));
        if (currentUser.getRole() != Role.GANADERO) {
            throw new BusinessException("ROLE_NOT_ALLOWED", "El rol autenticado no pertenece a un ganadero.", Response.Status.FORBIDDEN);
        }

        return ganaderoRepository.findByEmail(currentUser.getEmail())
                .orElseThrow(() -> new BusinessException("GANADERO_NOT_FOUND", "No encontramos el ganadero autenticado.", Response.Status.NOT_FOUND))
                .getId();
    }

    private List<VetVisitItemDto> groupVetVisits(List<AnimalHealthEvent> events) {
        return groupVetVisitItems(events).stream()
                .sorted(Comparator.comparing(VetVisitItemDto::occurredAt, Comparator.nullsLast(Comparator.naturalOrder())).reversed()
                        .thenComparing(VetVisitItemDto::visitId, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
    }

    private List<VetVisitItemDto> groupVetVisitItems(List<AnimalHealthEvent> events) {
        Map<String, List<AnimalHealthEvent>> groups = new LinkedHashMap<>();
        for (AnimalHealthEvent event : events) {
            Map<String, Object> metadata = animalHealthEventMapper.readMetadataJson(event.getMetadataJson());
            Map<String, Object> visit = readVisit(metadata);
            String visitId = readText(visit.get("visitId"));
            String mode = readText(visit.get("mode"));
            String key = visitId != null ? "VISIT:" + visitId : "EVENT:" + event.getEventId();
            groups.computeIfAbsent(key, ignored -> new ArrayList<>()).add(event);
        }
        return groups.values().stream()
                .map(this::toVetVisitItem)
                .toList();
    }

    private VetVisitItemDto toVetVisitItem(List<AnimalHealthEvent> group) {
        AnimalHealthEvent representative = group.stream()
                .max(vetVisitLifecycleComparator())
                .orElseThrow();
        Map<String, Object> metadata = animalHealthEventMapper.readMetadataJson(representative.getMetadataJson());
        Map<String, Object> visit = readVisit(metadata);
        String mode = readText(visit.get("mode"));
        String status = readText(visit.get("status"));
        String parentVisitId = readText(visit.get("parentVisitId"));
        Map<String, Object> veterinarian = readMap(visit.get("veterinarian"));
        OffsetDateTime nextControlAt = readOffsetDateTime(visit.get("nextControlAt"));
        if (nextControlAt == null) {
            nextControlAt = animalHealthEventMapper.readNextDueAt(metadata);
        }
        return new VetVisitItemDto(
                readText(visit.get("visitId")),
                mode,
                status,
                parentVisitId,
                animalHealthEventMapper.readCancelReason(metadata),
                deriveChainStatus(status, parentVisitId, metadata),
                new VetVisitItemDto.VeterinarianDto(readText(veterinarian.get("name")), readText(veterinarian.get("license"))),
                representative.getOccurredAt().atOffset(ZoneOffset.UTC),
                nextControlAt,
                "GLOBAL".equalsIgnoreCase(mode) ? null : representative.getAnimal().getUuid(),
                resolveTargetAnimalCount(visit, group),
                readAtencionNotas(visit, metadata),
                readCostAmount(metadata),
                readCostCurrency(metadata),
                animalHealthEventMapper.readTreatmentPlan(metadata));
    }

    private Comparator<AnimalHealthEvent> vetVisitLifecycleComparator() {
        return Comparator.comparingInt(this::lifecycleRank)
                .thenComparing(AnimalHealthEvent::getOccurredAt, Comparator.nullsFirst(Comparator.naturalOrder()))
                .thenComparing(AnimalHealthEvent::getClientCreatedAt, Comparator.nullsFirst(Comparator.naturalOrder()))
                .thenComparing(AnimalHealthEvent::getCreatedAt, Comparator.nullsFirst(Comparator.naturalOrder()))
                .thenComparing(AnimalHealthEvent::getEventId, Comparator.nullsFirst(Comparator.naturalOrder()));
    }

    private int lifecycleRank(AnimalHealthEvent event) {
        Map<String, Object> metadata = animalHealthEventMapper.readMetadataJson(event.getMetadataJson());
        Map<String, Object> visit = readVisit(metadata);
        String status = readText(visit.get("status"));
        String protocolStatus = animalHealthEventMapper.readFieldVetProtocolStatus(metadata);
        if ("CANCELADA".equalsIgnoreCase(status) || "CANCELED".equalsIgnoreCase(status)) {
            return 40;
        }
        if ("ATENDIDA".equalsIgnoreCase(status) || "ATTENDED".equalsIgnoreCase(status)
                || "CLOSED".equalsIgnoreCase(protocolStatus)) {
            return 30;
        }
        if ("REPROGRAMADA".equalsIgnoreCase(status) || "RESCHEDULED".equalsIgnoreCase(status)) {
            return 20;
        }
        return 10;
    }

    private String deriveChainStatus(String visitStatus, String parentVisitId, Map<String, Object> metadata) {
        String protocolStatus = animalHealthEventMapper.readFieldVetProtocolStatus(metadata);
        if ("CLOSED".equalsIgnoreCase(protocolStatus) || "CANCELADA".equalsIgnoreCase(visitStatus) || "CANCELED".equalsIgnoreCase(visitStatus)) {
            return "CLOSED";
        }
        return "ACTIVE";
    }

    private BigDecimal readCostAmount(Map<String, Object> metadata) {
        Map<String, Object> cost = animalHealthEventMapper.readCost(metadata);
        if (cost == null || !(cost.get("amount") instanceof Number amount)) {
            return null;
        }
        if (amount instanceof BigDecimal decimal) {
            return decimal;
        }
        return BigDecimal.valueOf(amount.doubleValue());
    }

    private String readCostCurrency(Map<String, Object> metadata) {
        Map<String, Object> cost = animalHealthEventMapper.readCost(metadata);
        if (cost == null) {
            return null;
        }
        return readText(cost.get("currency"));
    }

    private Integer resolveTargetAnimalCount(Map<String, Object> visit, List<AnimalHealthEvent> group) {
        Object targetAnimalCount = visit.get("targetAnimalCount");
        if (targetAnimalCount instanceof Number number) {
            return number.intValue();
        }
        return (int) group.stream()
                .map(AnimalHealthEvent::getAnimal)
                .filter(animal -> animal != null && animal.getUuid() != null)
                .map(Animal::getUuid)
                .distinct()
                .count();
    }

    private String readAtencionNotas(Map<String, Object> visit, Map<String, Object> metadata) {
        String notes = readText(visit.get("atencionNotas"));
        return notes == null ? readText(metadata.get("atencionNotas")) : notes;
    }

    private Map<String, Object> readVisit(Map<String, Object> metadata) {
        return readMap(metadata.get("visit"));
    }

    private Map<String, Object> readMap(Object value) {
        if (!(value instanceof Map<?, ?> map)) {
            return Map.of();
        }
        Map<String, Object> normalized = new LinkedHashMap<>();
        map.forEach((key, nestedValue) -> normalized.put(String.valueOf(key), nestedValue));
        return normalized;
    }

    private String readText(Object value) {
        return value instanceof String text && !text.isBlank() ? text.trim() : null;
    }

    private OffsetDateTime readOffsetDateTime(Object value) {
        if (!(value instanceof String text) || text.isBlank()) {
            return null;
        }
        return OffsetDateTime.parse(text);
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
        String visitStatus = normalizeVisitStatus(animalHealthEventMapper.readFieldVetVisitStatus(metadata));
        if (visitStatus != null) {
            validateFieldVetVisitLifecycle(animalUuid, visitId, visitStatus);
            return;
        }

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

    private void validateFieldVetVisitLifecycle(UUID animalUuid, String visitId, String nextStatus) {
        List<AnimalHealthEvent> timeline = animalHealthEventRepository.listByVisit(animalUuid, visitId, null, null);
        String currentStatus = timeline.stream()
                .map(event -> normalizeVisitStatus(animalHealthEventMapper.readFieldVetVisitStatus(
                        animalHealthEventMapper.readMetadataJson(event.getMetadataJson()))))
                .filter(status -> status != null)
                .reduce((ignored, latest) -> latest)
                .orElse(null);

        if (currentStatus == null) {
            return;
        }
        if (isTerminalVisitStatus(currentStatus)) {
            throw new BusinessException(
                    "ANIMAL_HEALTH_EVENT_VET_VISIT_CLOSED",
                    "Esa visita veterinaria ya fue cerrada.",
                    Response.Status.BAD_REQUEST);
        }
        if (!isAllowedVisitTransition(currentStatus, nextStatus)) {
            throw new BusinessException(
                    "ANIMAL_HEALTH_EVENT_VET_VISIT_INVALID_TRANSITION",
                    "La transición de estado de la visita veterinaria no es válida.",
                    Response.Status.BAD_REQUEST);
        }
    }

    private boolean isAllowedVisitTransition(String currentStatus, String nextStatus) {
        return switch (currentStatus) {
            case "PROGRAMADA" -> "ATENDIDA".equals(nextStatus)
                    || "REPROGRAMADA".equals(nextStatus)
                    || "FINALIZADA".equals(nextStatus)
                    || "CANCELADA".equals(nextStatus);
            case "ATENDIDA" -> "REPROGRAMADA".equals(nextStatus) || "FINALIZADA".equals(nextStatus) || "CANCELADA".equals(nextStatus);
            case "REPROGRAMADA" -> "ATENDIDA".equals(nextStatus) || "FINALIZADA".equals(nextStatus) || "CANCELADA".equals(nextStatus);
            default -> false;
        };
    }

    private boolean isTerminalVisitStatus(String status) {
        return "FINALIZADA".equals(status) || "CANCELADA".equals(status);
    }

    private String normalizeVisitStatus(String status) {
        if (status == null || status.isBlank()) {
            return null;
        }
        return switch (status.trim().toUpperCase()) {
            case "PENDING" -> "PROGRAMADA";
            case "ATTENDED" -> "ATENDIDA";
            case "RESCHEDULED" -> "REPROGRAMADA";
            case "FINALIZED" -> "FINALIZADA";
            case "CANCELED" -> "CANCELADA";
            default -> status.trim().toUpperCase();
        };
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
            String visitStatus = normalizeVisitStatus(animalHealthEventMapper.readFieldVetVisitStatus(metadata));
            if (visitStatus != null) {
                return new FollowUpProjection(
                        isTerminalVisitStatus(visitStatus) ? "CLOSED" : "ACTIVE",
                        animalHealthEventMapper.readNextDueAt(metadata));
            }
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

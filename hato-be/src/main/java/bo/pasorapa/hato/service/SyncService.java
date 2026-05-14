package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.AnimalEventLog;
import bo.pasorapa.hato.domain.AnimalImage;
import bo.pasorapa.hato.domain.AdminNotificationRecipient;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.HerdCostLedger;
import bo.pasorapa.hato.domain.HerdLot;
import bo.pasorapa.hato.domain.HerdLotAssignment;
import bo.pasorapa.hato.domain.HerdProductivityLedger;
import bo.pasorapa.hato.domain.SyncConflictAuditLedger;
import bo.pasorapa.hato.domain.SyncOperationReceipt;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.enumeration.AnimalEventCategory;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.AdminNotificationRepository;
import bo.pasorapa.hato.repository.AnimalEventLogRepository;
import bo.pasorapa.hato.repository.AnimalImageRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.HerdCostLedgerRepository;
import bo.pasorapa.hato.repository.HerdLotAssignmentRepository;
import bo.pasorapa.hato.repository.HerdLotRepository;
import bo.pasorapa.hato.repository.HerdProductivityLedgerRepository;
import bo.pasorapa.hato.repository.SyncConflictAuditLedgerRepository;
import bo.pasorapa.hato.repository.SyncOperationReceiptRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.dto.admin.common.MutationResult;
import bo.pasorapa.hato.service.dto.admin.ganadero.GanaderoCreateRequest;
import bo.pasorapa.hato.service.dto.AnimalRequest;
import bo.pasorapa.hato.service.dto.animalhealthevent.AnimalHealthEventRequest;
import bo.pasorapa.hato.service.dto.animalimage.AnimalImageRequest;
import bo.pasorapa.hato.service.dto.animalreproductionevent.AnimalReproductionEventRequest;
import bo.pasorapa.hato.service.dto.animalevent.AnimalEventRequest;
import bo.pasorapa.hato.service.mapper.SyncPayloadMapper;
import bo.pasorapa.hato.service.model.AnimalEvent;
import bo.pasorapa.hato.service.model.AnimalHealthEvent;
import bo.pasorapa.hato.service.model.AnimalReproductionEvent;
import bo.pasorapa.hato.service.mapper.AdminNotificationMapper;
import bo.pasorapa.hato.service.mapper.AnimalEventMapper;
import bo.pasorapa.hato.service.mapper.AnimalHealthEventMapper;
import bo.pasorapa.hato.service.mapper.AnimalImageMapper;
import bo.pasorapa.hato.service.mapper.AnimalImageSecuritySupport;
import bo.pasorapa.hato.service.mapper.AnimalReproductionEventMapper;
import bo.pasorapa.hato.service.dto.sync.PullSyncResponse;
import bo.pasorapa.hato.service.dto.sync.PushSyncRequest;
import bo.pasorapa.hato.service.dto.sync.PushSyncResponse;
import bo.pasorapa.hato.service.dto.sync.ConflictDiffField;
import bo.pasorapa.hato.service.dto.sync.ManualResolutionAction;
import bo.pasorapa.hato.service.dto.sync.ResolveConflictRequest;
import bo.pasorapa.hato.service.dto.sync.ResolveConflictResponse;
import bo.pasorapa.hato.service.dto.sync.ResolutionPolicyResponse;
import bo.pasorapa.hato.service.dto.sync.SyncConflictResponse;
import bo.pasorapa.hato.service.dto.sync.SyncConflictAuditEntryResponse;
import bo.pasorapa.hato.service.dto.sync.SyncConflictListItemResponse;
import bo.pasorapa.hato.service.dto.sync.SyncCursorResponse;
import bo.pasorapa.hato.service.dto.sync.SyncEntityType;
import bo.pasorapa.hato.service.dto.sync.SyncMetricDictionaryEntry;
import bo.pasorapa.hato.service.dto.sync.SyncObservabilityResponse;
import bo.pasorapa.hato.service.dto.sync.SyncOperationRequest;
import bo.pasorapa.hato.service.dto.sync.SyncOperationResult;
import bo.pasorapa.hato.service.dto.sync.SyncOperationType;
import bo.pasorapa.hato.service.error.BusinessException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.Duration;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.HashMap;
import java.util.Objects;
import java.util.UUID;

@ApplicationScoped
public class SyncService {

    private static final int PULL_PAGE_SIZE = 100;
    private static final String OPERATION_NOT_ALLOWED_OFFLINE = "OPERATION_NOT_ALLOWED_OFFLINE";
    private static final String SYNC_HANDLER_NOT_IMPLEMENTED_YET = "SYNC_HANDLER_NOT_IMPLEMENTED_YET";
    private static final String VERSION_CONFLICT_REASON = "STALE_VERSION_DETECTED";
    private static final String V1_RESOLUTION_HINT = "manual_refresh";
    private static final String V2_RESOLUTION_HINT = "manual_resolution";
    private static final String CONFLICT_RESULT_VERSION = "v2";
    private static final int CONFLICT_LEDGER_TTL_DAYS = 365;
    private static final int OBSERVABILITY_RECENT_LIMIT = 20;
    private static final long OBSERVABILITY_STALE_DEFAULT_MS = 24L * 60L * 60L * 1000L;
    private static final List<SyncMetricDictionaryEntry> OBSERVABILITY_DICTIONARY = List.of(
            new SyncMetricDictionaryEntry("cycle", "Ciclo", "runtime", "Trigger, timestamps y latencias del ciclo actual."),
            new SyncMetricDictionaryEntry("queue", "Cola", "hybrid", "Pendientes y resultados por estado y entidad."),
            new SyncMetricDictionaryEntry("errors", "Errores", "hybrid", "Razones operativas rankeadas y recientes limitados."),
            new SyncMetricDictionaryEntry("conflicts", "Conflictos", "hybrid", "Abiertos, resueltos y operaciones bloqueadas."),
            new SyncMetricDictionaryEntry("entityHealth", "Salud por entidad", "hybrid", "Freshness por entidad usando actividad reciente."));

    private final AnimalRepository animalRepository;
    private final AdminNotificationRepository adminNotificationRepository;
    private final AnimalEventLogRepository animalEventLogRepository;
    private final AnimalImageRepository animalImageRepository;
    private final UserRepository userRepository;
    private final GanaderoRepository ganaderoRepository;
    private final HerdLotRepository herdLotRepository;
    private final HerdLotAssignmentRepository herdLotAssignmentRepository;
    private final HerdProductivityLedgerRepository herdProductivityLedgerRepository;
    private final HerdCostLedgerRepository herdCostLedgerRepository;
    private final SyncConflictAuditLedgerRepository syncConflictAuditLedgerRepository;
    private final SyncOperationReceiptRepository syncOperationReceiptRepository;
    private final AnimalService animalService;
    private final AnimalEventService animalEventService;
    private final AnimalHealthEventService animalHealthEventService;
    private final AnimalImageService animalImageService;
    private final AnimalReproductionEventService animalReproductionEventService;
    private final AdminUserService adminUserService;
    private final GanaderoService ganaderoService;
    private final SyncPayloadMapper syncPayloadMapper;
    private final AnimalEventMapper animalEventMapper;
    private final AnimalHealthEventMapper animalHealthEventMapper;
    private final AnimalImageMapper animalImageMapper;
    private final AnimalReproductionEventMapper animalReproductionEventMapper;
    private final AdminNotificationMapper adminNotificationMapper;
    private final ObjectMapper objectMapper;

    public SyncService(
            AnimalRepository animalRepository,
            AdminNotificationRepository adminNotificationRepository,
            AnimalEventLogRepository animalEventLogRepository,
            AnimalImageRepository animalImageRepository,
            UserRepository userRepository,
            GanaderoRepository ganaderoRepository,
            HerdLotRepository herdLotRepository,
            HerdLotAssignmentRepository herdLotAssignmentRepository,
            HerdProductivityLedgerRepository herdProductivityLedgerRepository,
            HerdCostLedgerRepository herdCostLedgerRepository,
            SyncConflictAuditLedgerRepository syncConflictAuditLedgerRepository,
            SyncOperationReceiptRepository syncOperationReceiptRepository,
            AnimalService animalService,
            AnimalEventService animalEventService,
            AnimalHealthEventService animalHealthEventService,
            AnimalImageService animalImageService,
            AnimalReproductionEventService animalReproductionEventService,
            AdminUserService adminUserService,
            GanaderoService ganaderoService,
            SyncPayloadMapper syncPayloadMapper,
            AnimalEventMapper animalEventMapper,
            AnimalHealthEventMapper animalHealthEventMapper,
            AnimalImageMapper animalImageMapper,
            AnimalReproductionEventMapper animalReproductionEventMapper,
            AdminNotificationMapper adminNotificationMapper,
            ObjectMapper objectMapper) {
        this.animalRepository = animalRepository;
        this.adminNotificationRepository = adminNotificationRepository;
        this.animalEventLogRepository = animalEventLogRepository;
        this.animalImageRepository = animalImageRepository;
        this.userRepository = userRepository;
        this.ganaderoRepository = ganaderoRepository;
        this.herdLotRepository = herdLotRepository;
        this.herdLotAssignmentRepository = herdLotAssignmentRepository;
        this.herdProductivityLedgerRepository = herdProductivityLedgerRepository;
        this.herdCostLedgerRepository = herdCostLedgerRepository;
        this.syncConflictAuditLedgerRepository = syncConflictAuditLedgerRepository;
        this.syncOperationReceiptRepository = syncOperationReceiptRepository;
        this.animalService = animalService;
        this.animalEventService = animalEventService;
        this.animalHealthEventService = animalHealthEventService;
        this.animalImageService = animalImageService;
        this.animalReproductionEventService = animalReproductionEventService;
        this.adminUserService = adminUserService;
        this.ganaderoService = ganaderoService;
        this.syncPayloadMapper = syncPayloadMapper;
        this.animalEventMapper = animalEventMapper;
        this.animalHealthEventMapper = animalHealthEventMapper;
        this.animalImageMapper = animalImageMapper;
        this.animalReproductionEventMapper = animalReproductionEventMapper;
        this.adminNotificationMapper = adminNotificationMapper;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public PushSyncResponse push(PushSyncRequest request) {
        return push(request, null);
    }

    @Transactional
    public PushSyncResponse push(PushSyncRequest request, UUID currentUserId) {
        return push(request, currentUserId, false);
    }

    @Transactional
    public PushSyncResponse push(PushSyncRequest request, UUID currentUserId, boolean conflictResolutionV2Enabled) {
        java.util.Map<UUID, Integer> animalImageCounts = new java.util.HashMap<>();
        List<SyncOperationResult> results = new java.util.ArrayList<>();
        for (SyncOperationRequest operation : request.operations()) {
            if (operation.entityType() == SyncEntityType.ANIMAL_IMAGE && operation.opType() == SyncOperationType.CREATE) {
                UUID animalUuid = syncPayloadMapper.parseUuid(String.valueOf(operation.payload().get("animalUuid")));
                if (animalUuid != null) {
                    int nextCount = animalImageCounts.getOrDefault(animalUuid, 0) + 1;
                    animalImageCounts.put(animalUuid, nextCount);
                    if (nextCount > AnimalImageSecuritySupport.V1_MAX_IMAGES_PER_ANIMAL_PER_SYNC) {
                        results.add(persistReceipt(operation, validationError(operation, "ANIMAL_IMAGE_SYNC_BATCH_LIMIT_EXCEEDED", conflictResolutionV2Enabled), currentUserId));
                        continue;
                    }
                }
            }
            results.add(processOperation(operation, currentUserId, conflictResolutionV2Enabled));
        }

        return new PushSyncResponse(results);
    }

    public PullSyncResponse pull(SyncEntityType entityType, OffsetDateTime cursorUpdatedAt, String cursorId) {
        return pull(entityType, cursorUpdatedAt, cursorId, null);
    }

    public PullSyncResponse pull(SyncEntityType entityType, OffsetDateTime cursorUpdatedAt, String cursorId, UUID currentUserId) {
        LocalDateTime effectiveCursorUpdatedAt = cursorUpdatedAt == null
                ? null
                : cursorUpdatedAt.withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime();
        UUID effectiveCursorId = syncPayloadMapper.parseUuid(cursorId);

        return switch (entityType) {
            case ANIMAL -> buildPullResponse(
                    entityType,
                    animalRepository.listChangedSince(effectiveCursorUpdatedAt, effectiveCursorId, PULL_PAGE_SIZE + 1),
                    cursorUpdatedAt,
                    cursorId,
                    animal -> new PullCursorItem(toPullItem(animal), animal.getUpdatedAt().atOffset(ZoneOffset.UTC), animal.getUuid().toString()));
            case USER -> buildPullResponse(
                    entityType,
                    userRepository.listChangedSince(effectiveCursorUpdatedAt, effectiveCursorId, PULL_PAGE_SIZE + 1),
                    cursorUpdatedAt,
                    cursorId,
                    user -> new PullCursorItem(toPullItem(user), user.getUpdatedAt().atOffset(ZoneOffset.UTC), user.getId().toString()));
            case GANADERO -> buildPullResponse(
                    entityType,
                    ganaderoRepository.listChangedSince(effectiveCursorUpdatedAt, effectiveCursorId, PULL_PAGE_SIZE + 1),
                    cursorUpdatedAt,
                    cursorId,
                    ganadero -> new PullCursorItem(toPullItem(ganadero), ganadero.getUpdatedAt().atOffset(ZoneOffset.UTC), ganadero.getId().toString()));
            case LOT -> buildPullResponse(
                    entityType,
                    herdLotRepository.listChangedSince(effectiveCursorUpdatedAt, effectiveCursorId, PULL_PAGE_SIZE + 1),
                    cursorUpdatedAt,
                    cursorId,
                    lot -> new PullCursorItem(toPullItem(lot), lot.getUpdatedAt().atOffset(ZoneOffset.UTC), lot.getLotId().toString()));
            case LOT_ASSIGNMENT -> buildPullResponse(
                    entityType,
                    herdLotAssignmentRepository.listChangedSince(effectiveCursorUpdatedAt, effectiveCursorId, PULL_PAGE_SIZE + 1),
                    cursorUpdatedAt,
                    cursorId,
                    assignment -> new PullCursorItem(toPullItem(assignment), assignment.getUpdatedAt().atOffset(ZoneOffset.UTC), assignment.getAssignmentId().toString()));
            case PRODUCTIVITY_LEDGER -> buildPullResponse(
                    entityType,
                    herdProductivityLedgerRepository.listChangedSince(effectiveCursorUpdatedAt, effectiveCursorId, PULL_PAGE_SIZE + 1),
                    cursorUpdatedAt,
                    cursorId,
                    entry -> new PullCursorItem(toPullItem(entry), entry.getUpdatedAt().atOffset(ZoneOffset.UTC), entry.getEntryId().toString()));
            case COST_LEDGER -> buildPullResponse(
                    entityType,
                    herdCostLedgerRepository.listChangedSince(effectiveCursorUpdatedAt, effectiveCursorId, PULL_PAGE_SIZE + 1),
                    cursorUpdatedAt,
                    cursorId,
                    entry -> new PullCursorItem(toPullItem(entry), entry.getUpdatedAt().atOffset(ZoneOffset.UTC), entry.getEntryId().toString()));
            case ANIMAL_EVENT_LOG -> buildPullResponse(
                    entityType,
                    animalEventLogRepository.listChangedSince(effectiveCursorUpdatedAt, effectiveCursorId, PULL_PAGE_SIZE + 1),
                    cursorUpdatedAt,
                    cursorId,
                    event -> new PullCursorItem(toPullItem(event), event.getUpdatedAt().atOffset(ZoneOffset.UTC), event.getEventId().toString()));
            case ANIMAL_EVENT -> buildPullResponse(
                    entityType,
                    animalEventLogRepository.listChangedSince(AnimalEventCategory.GENERAL, effectiveCursorUpdatedAt, effectiveCursorId, PULL_PAGE_SIZE + 1),
                    cursorUpdatedAt,
                    cursorId,
                    event -> new PullCursorItem(toLegacyAnimalEventPullItem(event), event.getUpdatedAt().atOffset(ZoneOffset.UTC), event.getEventId().toString()));
            case ANIMAL_HEALTH_EVENT -> buildPullResponse(
                    entityType,
                    animalEventLogRepository.listChangedSince(AnimalEventCategory.HEALTH, effectiveCursorUpdatedAt, effectiveCursorId, PULL_PAGE_SIZE + 1),
                    cursorUpdatedAt,
                    cursorId,
                    event -> new PullCursorItem(toLegacyAnimalHealthEventPullItem(event), event.getUpdatedAt().atOffset(ZoneOffset.UTC), event.getEventId().toString()));
            case ANIMAL_REPRODUCTION_EVENT -> buildPullResponse(
                    entityType,
                    animalEventLogRepository.listChangedSince(AnimalEventCategory.REPRODUCTION, effectiveCursorUpdatedAt, effectiveCursorId, PULL_PAGE_SIZE + 1),
                    cursorUpdatedAt,
                    cursorId,
                    event -> new PullCursorItem(toLegacyAnimalReproductionEventPullItem(event), event.getUpdatedAt().atOffset(ZoneOffset.UTC), event.getEventId().toString()));
            case ANIMAL_IMAGE -> buildPullResponse(
                    entityType,
                    animalImageRepository.listChangedSince(effectiveCursorUpdatedAt, effectiveCursorId, PULL_PAGE_SIZE + 1),
                    cursorUpdatedAt,
                    cursorId,
                    image -> new PullCursorItem(animalImageMapper.toPullItem(image), image.getUpdatedAt().atOffset(ZoneOffset.UTC), image.getImageId().toString()));
            case NOTIFICATION -> buildPullResponse(
                    entityType,
                    adminNotificationRepository.listChangedSinceForRecipient(currentUserId, effectiveCursorUpdatedAt, effectiveCursorId, PULL_PAGE_SIZE + 1),
                    cursorUpdatedAt,
                    cursorId,
                    recipient -> new PullCursorItem(adminNotificationMapper.toPullItem(recipient), recipient.getUpdatedAt().atOffset(ZoneOffset.UTC), recipient.getNotification().getId().toString()));
        };
    }

    public SyncObservabilityResponse getObservability(String requestedWindow) {
        String window = resolveObservabilityWindow(requestedWindow);
        LocalDateTime since = LocalDateTime.now().minusHours("7d".equals(window) ? 24L * 7L : 24L);
        List<SyncOperationReceipt> receipts = syncOperationReceiptRepository.listByWindow(since);
        List<SyncConflictAuditLedger> ledgerEntries = syncConflictAuditLedgerRepository.listByWindow(since);

        Map<String, Long> totals = new LinkedHashMap<>();
        totals.put("totalReceipts", (long) receipts.size());
        totals.put("no_conflict", receipts.stream().filter(receipt -> "no_conflict".equals(receipt.getClassification())).count());
        totals.put("version_conflict", receipts.stream().filter(receipt -> "version_conflict".equals(receipt.getClassification())).count());
        totals.put("validation_error", receipts.stream().filter(receipt -> "validation_error".equals(receipt.getClassification())).count());

        Map<String, Map<String, Long>> byEntity = new LinkedHashMap<>();
        for (SyncOperationReceipt receipt : receipts) {
            Map<String, Long> entityCounters = byEntity.computeIfAbsent(receipt.getEntityType(), ignored -> new LinkedHashMap<>());
            entityCounters.merge(receipt.getClassification(), 1L, Long::sum);
            entityCounters.merge(receipt.getOperationType() == null ? "UNKNOWN" : receipt.getOperationType(), 1L, Long::sum);
        }

        Map<String, ReasonAggregate> reasonCounters = new HashMap<>();
        for (SyncOperationReceipt receipt : receipts) {
            if (receipt.getReason() == null || receipt.getReason().isBlank()) {
              continue;
            }
            String key = "receipt:" + receipt.getReason();
            ReasonAggregate aggregate = reasonCounters.computeIfAbsent(key, ignored -> new ReasonAggregate(receipt.getReason(), "receipt"));
            aggregate.count += 1;
        }
        for (SyncConflictAuditLedger entry : ledgerEntries) {
            if (entry.getReason() == null || entry.getReason().isBlank()) {
              continue;
            }
            String key = "conflict_ledger:" + entry.getReason();
            ReasonAggregate aggregate = reasonCounters.computeIfAbsent(key, ignored -> new ReasonAggregate(entry.getReason(), "conflict_ledger"));
            aggregate.count += 1;
        }

        List<SyncObservabilityResponse.TopReason> topReasons = reasonCounters.values().stream()
                .sorted((left, right) -> Long.compare(right.count, left.count))
                .limit(OBSERVABILITY_RECENT_LIMIT)
                .map(aggregate -> new SyncObservabilityResponse.TopReason(aggregate.reason, aggregate.count, aggregate.source))
                .toList();

        Map<UUID, SyncConflictAuditLedger> latestByOperation = new HashMap<>();
        for (SyncConflictAuditLedger entry : ledgerEntries) {
            SyncConflictAuditLedger current = latestByOperation.get(entry.getOperationId());
            if (current == null || current.getCreatedAt().isBefore(entry.getCreatedAt())) {
                latestByOperation.put(entry.getOperationId(), entry);
            }
        }
        long resolved = latestByOperation.values().stream().filter(entry -> "RESOLVED".equals(entry.getEventType())).count();
        long open = latestByOperation.values().stream().filter(entry -> !"RESOLVED".equals(entry.getEventType())).count();

        Map<String, SyncObservabilityResponse.EntityHealth> entityHealth = new LinkedHashMap<>();
        for (Map.Entry<String, Map<String, Long>> entry : byEntity.entrySet()) {
            SyncOperationReceipt latest = receipts.stream()
                    .filter(receipt -> entry.getKey().equals(receipt.getEntityType()))
                    .max(Comparator.comparing(SyncOperationReceipt::getCreatedAt))
                    .orElse(null);
            Long stalenessMs = latest == null ? null : Duration.between(latest.getCreatedAt(), LocalDateTime.now()).toMillis();
            entityHealth.put(entry.getKey(), new SyncObservabilityResponse.EntityHealth(
                    latest == null ? null : latest.getCreatedAt().atOffset(ZoneOffset.UTC).toString(),
                    latest == null ? null : latest.getCreatedAt().atOffset(ZoneOffset.UTC).toString(),
                    stalenessMs,
                    stalenessMs == null || stalenessMs > OBSERVABILITY_STALE_DEFAULT_MS));
        }

        List<SyncObservabilityResponse.RecentIssue> recentIssues = new ArrayList<>();
        receipts.stream()
                .filter(receipt -> !"no_conflict".equals(receipt.getClassification()))
                .sorted(Comparator.comparing(SyncOperationReceipt::getCreatedAt).reversed())
                .limit(OBSERVABILITY_RECENT_LIMIT)
                .forEach(receipt -> recentIssues.add(new SyncObservabilityResponse.RecentIssue(
                        "receipt",
                        receipt.getOperationId().toString(),
                        receipt.getEntityType(),
                        receipt.getEntityId(),
                        receipt.getClassification(),
                        Objects.requireNonNullElse(receipt.getReason(), receipt.getClassification()),
                        receipt.getCreatedAt().atOffset(ZoneOffset.UTC).toString())));
        ledgerEntries.stream()
                .sorted(Comparator.comparing(SyncConflictAuditLedger::getCreatedAt).reversed())
                .limit(Math.max(0, OBSERVABILITY_RECENT_LIMIT - recentIssues.size()))
                .forEach(entry -> recentIssues.add(new SyncObservabilityResponse.RecentIssue(
                        "conflict_ledger",
                        entry.getOperationId().toString(),
                        entry.getEntityType(),
                        entry.getEntityId(),
                        entry.getEventType(),
                        entry.getReason(),
                        entry.getCreatedAt().atOffset(ZoneOffset.UTC).toString())));

        String latestReceiptAt = receipts.stream()
                .map(SyncOperationReceipt::getCreatedAt)
                .max(LocalDateTime::compareTo)
                .map(value -> value.atOffset(ZoneOffset.UTC).toString())
                .orElse(null);
        String oldestIssueAt = receipts.stream()
                .filter(receipt -> !"no_conflict".equals(receipt.getClassification()))
                .map(SyncOperationReceipt::getCreatedAt)
                .min(LocalDateTime::compareTo)
                .map(value -> value.atOffset(ZoneOffset.UTC).toString())
                .orElse(null);

        return new SyncObservabilityResponse(
                window,
                OBSERVABILITY_DICTIONARY,
                totals,
                byEntity,
                topReasons,
                new SyncObservabilityResponse.ConflictSummary(open, resolved, open),
                entityHealth,
                new SyncObservabilityResponse.LatencySummary(latestReceiptAt, oldestIssueAt, OBSERVABILITY_STALE_DEFAULT_MS),
                recentIssues.stream().limit(OBSERVABILITY_RECENT_LIMIT).toList());
    }

    public String resolveObservabilityWindow(String requestedWindow) {
        if (requestedWindow == null || requestedWindow.isBlank()) {
            return "24h";
        }
        if (!List.of("24h", "7d").contains(requestedWindow)) {
            throw new BusinessException("SYNC_OBSERVABILITY_WINDOW_INVALID", "La ventana de observabilidad debe ser 24h o 7d.", jakarta.ws.rs.core.Response.Status.BAD_REQUEST);
        }
        return requestedWindow;
    }

    public List<SyncConflictListItemResponse> listConflicts(UUID operationId) {
        if (operationId != null) {
            SyncOperationReceipt receipt = syncOperationReceiptRepository.findByIdOptional(operationId)
                    .orElseThrow(() -> new BusinessException("SYNC_CONFLICT_NOT_FOUND", "No encontramos el conflicto solicitado.", jakarta.ws.rs.core.Response.Status.NOT_FOUND));
            return List.of(toConflictItem(receipt));
        }

        return syncOperationReceiptRepository.listConflictCandidates().stream()
                .filter(receipt -> toResult(receipt, true).conflict() != null)
                .filter(receipt -> !isResolved(receipt.getOperationId()))
                .sorted(Comparator.comparing(SyncOperationReceipt::getCreatedAt).reversed())
                .map(this::toConflictItem)
                .toList();
    }

    @Transactional
    public ResolveConflictResponse resolveConflict(UUID operationId, ResolveConflictRequest request, UUID currentUserId) {
        SyncOperationReceipt receipt = syncOperationReceiptRepository.findByIdOptional(operationId)
                .orElseThrow(() -> new BusinessException("SYNC_CONFLICT_NOT_FOUND", "No encontramos el conflicto solicitado.", jakarta.ws.rs.core.Response.Status.NOT_FOUND));
        List<SyncConflictAuditLedger> auditTrail = syncConflictAuditLedgerRepository.listByOperationId(operationId);
        requireConflictOwnership(auditTrail, currentUserId);
        SyncOperationResult result = toResult(receipt, true);
        if (result.conflict() == null || result.conflict().policy() == null) {
            throw new BusinessException("SYNC_CONFLICT_NOT_RESOLVABLE", "El conflicto no tiene policy de resolución manual V2.", jakarta.ws.rs.core.Response.Status.CONFLICT);
        }

        ManualResolutionAction action;
        try {
            action = ManualResolutionAction.fromApiValue(request.action());
        } catch (IllegalArgumentException exception) {
            throw new BusinessException(exception.getMessage(), "La acción de resolución manual es inválida.", jakarta.ws.rs.core.Response.Status.BAD_REQUEST);
        }

        if (!result.conflict().allowedActions().contains(action.apiValue())) {
            throw new BusinessException("SYNC_CONFLICT_ACTION_NOT_ALLOWED", "La acción solicitada no está permitida por policy para esta operación.", jakarta.ws.rs.core.Response.Status.CONFLICT);
        }

        SyncConflictAuditLedger latest = auditTrail.isEmpty() ? null : auditTrail.getLast();
        String nextLocalStatus = action == ManualResolutionAction.RETRY_LOCAL ? "pending" : "acked";
        if (latest != null && "RESOLVED".equals(latest.getEventType())) {
            return new ResolveConflictResponse(
                    operationId,
                    "already_resolved",
                    CONFLICT_RESULT_VERSION,
                    latest.getResultStatus(),
                    result.entityId(),
                    result.serverVersion(),
                    result.conflict().serverState());
        }

        SyncConflictAuditLedger resolution = new SyncConflictAuditLedger();
        resolution.setOperationId(operationId);
        resolution.setEntityType(result.entityType().name());
        resolution.setEntityId(result.entityId());
        resolution.setOperationType(Objects.requireNonNullElse(receipt.getOperationType(), "UNKNOWN"));
        resolution.setEventType("RESOLVED");
        resolution.setDecision(action.apiValue());
        resolution.setResultStatus(nextLocalStatus);
        resolution.setReason(request.reason().trim());
        resolution.setActorUserId(currentUserId);
        resolution.setPolicyKey(result.conflict().policyKey());
        resolution.setRetentionExpiresAt(LocalDateTime.now().plusDays(CONFLICT_LEDGER_TTL_DAYS));
        syncConflictAuditLedgerRepository.persist(resolution);

        return new ResolveConflictResponse(
                operationId,
                "resolved",
                CONFLICT_RESULT_VERSION,
                nextLocalStatus,
                result.entityId(),
                result.serverVersion(),
                result.conflict().serverState());
    }

    private SyncOperationResult processOperation(SyncOperationRequest operation, UUID currentUserId, boolean conflictResolutionV2Enabled) {
        SyncOperationReceipt existingReceipt = syncOperationReceiptRepository.findById(operation.operationId());
        if (existingReceipt != null && !shouldReplayResolvedConflict(existingReceipt)) {
            return toResult(existingReceipt, conflictResolutionV2Enabled);
        }

        if (!syncPayloadMapper.isOfflineOperationAllowed(operation.entityType(), operation.opType())) {
            return persistReceipt(operation, validationError(operation, OPERATION_NOT_ALLOWED_OFFLINE, conflictResolutionV2Enabled), currentUserId);
        }

        try {
            return switch (operation.entityType()) {
                case ANIMAL -> switch (operation.opType()) {
                    case CREATE -> persistReceipt(operation, handleAnimalCreate(operation, currentUserId), currentUserId);
                    case UPDATE -> persistReceipt(operation, handleAnimalUpdate(operation, currentUserId, conflictResolutionV2Enabled), currentUserId);
                    default -> persistReceipt(operation, validationError(operation, SYNC_HANDLER_NOT_IMPLEMENTED_YET, conflictResolutionV2Enabled), currentUserId);
                };
                case USER -> switch (operation.opType()) {
                    case STATUS_UPDATE -> persistReceipt(operation, handleUserStatusUpdate(operation, currentUserId, conflictResolutionV2Enabled), currentUserId);
                    default -> persistReceipt(operation, validationError(operation, SYNC_HANDLER_NOT_IMPLEMENTED_YET, conflictResolutionV2Enabled), currentUserId);
                };
                case GANADERO -> switch (operation.opType()) {
                    case CREATE -> persistReceipt(operation, handleGanaderoCreate(operation, currentUserId), currentUserId);
                    case STATUS_UPDATE -> persistReceipt(operation, handleGanaderoStatusUpdate(operation, currentUserId, conflictResolutionV2Enabled), currentUserId);
                    default -> persistReceipt(operation, validationError(operation, SYNC_HANDLER_NOT_IMPLEMENTED_YET, conflictResolutionV2Enabled), currentUserId);
                };
                case LOT -> switch (operation.opType()) {
                    case CREATE, UPDATE -> persistReceipt(operation, handleLotUpsert(operation), currentUserId);
                    default -> persistReceipt(operation, validationError(operation, SYNC_HANDLER_NOT_IMPLEMENTED_YET, conflictResolutionV2Enabled), currentUserId);
                };
                case LOT_ASSIGNMENT -> switch (operation.opType()) {
                    case CREATE, UPDATE -> persistReceipt(operation, handleLotAssignmentUpsert(operation), currentUserId);
                    default -> persistReceipt(operation, validationError(operation, SYNC_HANDLER_NOT_IMPLEMENTED_YET, conflictResolutionV2Enabled), currentUserId);
                };
                case PRODUCTIVITY_LEDGER -> switch (operation.opType()) {
                    case CREATE, UPDATE -> persistReceipt(operation, handleProductivityLedgerUpsert(operation), currentUserId);
                    default -> persistReceipt(operation, validationError(operation, SYNC_HANDLER_NOT_IMPLEMENTED_YET, conflictResolutionV2Enabled), currentUserId);
                };
                case COST_LEDGER -> switch (operation.opType()) {
                    case CREATE, UPDATE -> persistReceipt(operation, handleCostLedgerUpsert(operation), currentUserId);
                    default -> persistReceipt(operation, validationError(operation, SYNC_HANDLER_NOT_IMPLEMENTED_YET, conflictResolutionV2Enabled), currentUserId);
                };
                case ANIMAL_EVENT_LOG -> switch (operation.opType()) {
                    case CREATE -> persistReceipt(operation, handleAnimalEventLogCreate(operation, currentUserId), currentUserId);
                    default -> persistReceipt(operation, validationError(operation, SYNC_HANDLER_NOT_IMPLEMENTED_YET, conflictResolutionV2Enabled), currentUserId);
                };
                case ANIMAL_EVENT -> switch (operation.opType()) {
                    case CREATE -> persistReceipt(operation, handleAnimalEventLogCreate(operation, currentUserId), currentUserId);
                    default -> persistReceipt(operation, validationError(operation, SYNC_HANDLER_NOT_IMPLEMENTED_YET, conflictResolutionV2Enabled), currentUserId);
                };
                case ANIMAL_HEALTH_EVENT -> switch (operation.opType()) {
                    case CREATE -> persistReceipt(operation, handleAnimalEventLogCreate(operation, currentUserId), currentUserId);
                    default -> persistReceipt(operation, validationError(operation, SYNC_HANDLER_NOT_IMPLEMENTED_YET, conflictResolutionV2Enabled), currentUserId);
                };
                case ANIMAL_REPRODUCTION_EVENT -> switch (operation.opType()) {
                    case CREATE -> persistReceipt(operation, handleAnimalEventLogCreate(operation, currentUserId), currentUserId);
                    default -> persistReceipt(operation, validationError(operation, SYNC_HANDLER_NOT_IMPLEMENTED_YET, conflictResolutionV2Enabled), currentUserId);
                };
                case ANIMAL_IMAGE -> switch (operation.opType()) {
                    case CREATE -> persistReceipt(operation, handleAnimalImageCreate(operation), currentUserId);
                    default -> persistReceipt(operation, validationError(operation, SYNC_HANDLER_NOT_IMPLEMENTED_YET, conflictResolutionV2Enabled), currentUserId);
                };
                case NOTIFICATION -> persistReceipt(operation, validationError(operation, OPERATION_NOT_ALLOWED_OFFLINE, conflictResolutionV2Enabled), currentUserId);
            };
        } catch (BusinessException exception) {
            return persistReceipt(operation, validationError(operation, exception.code(), conflictResolutionV2Enabled), currentUserId);
        } catch (IllegalArgumentException exception) {
            return persistReceipt(operation, validationError(operation, exception.getMessage(), conflictResolutionV2Enabled), currentUserId);
        }
    }

    private void requireConflictOwnership(List<SyncConflictAuditLedger> auditTrail, UUID currentUserId) {
        UUID conflictOwnerId = auditTrail.stream()
                .filter(entry -> "DETECTED".equals(entry.getEventType()))
                .map(SyncConflictAuditLedger::getActorUserId)
                .filter(Objects::nonNull)
                .findFirst()
                .orElse(null);
        if (conflictOwnerId != null && !conflictOwnerId.equals(currentUserId)) {
            throw new BusinessException(
                    "SYNC_CONFLICT_FORBIDDEN",
                    "Solo el usuario que originó el conflicto puede resolverlo.",
                    jakarta.ws.rs.core.Response.Status.FORBIDDEN);
        }
    }

    private static final class ReasonAggregate {
        private final String reason;
        private final String source;
        private long count;

        private ReasonAggregate(String reason, String source) {
            this.reason = reason;
            this.source = source;
            this.count = 0;
        }
    }

    private SyncOperationResult handleAnimalUpdate(SyncOperationRequest operation, UUID currentUserId, boolean conflictResolutionV2Enabled) {
        UUID entityUuid = syncPayloadMapper.parseUuid(operation.entityId());
        if (entityUuid == null) {
            return validationError(operation, "Invalid animal uuid.", conflictResolutionV2Enabled);
        }

        Animal animal = animalRepository.findByUuid(entityUuid)
                .orElse(null);
        if (animal == null) {
            return validationError(operation, "Animal not found for sync update.", conflictResolutionV2Enabled);
        }

        int currentVersion = animal.getVersion().intValue();
        if (!operation.baseVersion().equals(currentVersion)) {
            return versionConflict(operation, operation.entityId(), currentVersion, toPullItem(animal), conflictResolutionV2Enabled);
        }

        if (syncPayloadMapper.hasAnimalCorePayload(operation.payload())) {
            AnimalRequest request = syncPayloadMapper.toAnimalRequest(operation.payload());
            animal = animalService.update(entityUuid, request, currentUserId);
        } else {
            syncPayloadMapper.applyLegacyAnimalUpdatePayload(animal, operation.payload());
        }
        animal.setLastSyncedAt(LocalDateTime.now());
        animalRepository.flush();

        return noConflict(operation, operation.entityId(), animal.getVersion().intValue());
    }

    private SyncOperationResult handleAnimalCreate(SyncOperationRequest operation, UUID currentUserId) {
        UUID entityUuid = requireUuid(operation.entityId(), "Invalid animal uuid.");
        Animal existingAnimal = animalRepository.findByUuid(entityUuid).orElse(null);
        if (existingAnimal != null) {
            return noConflict(operation, existingAnimal.getUuid().toString(), existingAnimal.getVersion().intValue());
        }

        AnimalRequest request = syncPayloadMapper.toAnimalRequest(operation.payload());
        Animal createdAnimal = animalService.createWithUuid(entityUuid, request, currentUserId);
        animalRepository.flush();

        return noConflict(operation, createdAnimal.getUuid().toString(), createdAnimal.getVersion().intValue());
    }

    private SyncOperationResult handleUserStatusUpdate(SyncOperationRequest operation, UUID currentUserId, boolean conflictResolutionV2Enabled) {
        UUID userId = requireUuid(operation.entityId(), "Invalid user uuid.");
        User user = userRepository.findByIdOptional(userId).orElseThrow(() -> new BusinessException("USER_NOT_FOUND", "No encontramos el usuario solicitado.", jakarta.ws.rs.core.Response.Status.NOT_FOUND));

        int currentVersion = user.getVersion().intValue();
        if (!operation.baseVersion().equals(currentVersion)) {
            return versionConflict(operation, user.getId().toString(), currentVersion, toPullItem(user), conflictResolutionV2Enabled);
        }

        MutationResult<User> mutation = adminUserService.syncUpdateStatus(
                userId,
                syncPayloadMapper.readUserStatus(operation.payload()),
                operation.operationId(),
                currentUserId);

        return noConflict(operation, mutation.data().getId().toString(), mutation.data().getVersion().intValue());
    }

    private SyncOperationResult handleGanaderoCreate(SyncOperationRequest operation, UUID currentUserId) {
        UUID stableGanaderoId = operation.operationId();
        GanaderoCreateRequest createRequest = syncPayloadMapper.toGanaderoCreateRequest(operation.payload());
        MutationResult<Ganadero> mutation = ganaderoService.syncCreate(stableGanaderoId, createRequest, operation.operationId(), currentUserId);
        return noConflict(operation, mutation.data().getId().toString(), mutation.data().getVersion().intValue());
    }

    private SyncOperationResult handleGanaderoStatusUpdate(SyncOperationRequest operation, UUID currentUserId, boolean conflictResolutionV2Enabled) {
        UUID ganaderoId = requireUuid(operation.entityId(), "Invalid ganadero uuid.");
        Ganadero ganadero = ganaderoRepository.findByIdOptional(ganaderoId)
                .orElseThrow(() -> new BusinessException("GANADERO_NOT_FOUND", "No encontramos el ganadero solicitado.", jakarta.ws.rs.core.Response.Status.NOT_FOUND));

        int currentVersion = ganadero.getVersion().intValue();
        if (!operation.baseVersion().equals(currentVersion)) {
            return versionConflict(operation, ganadero.getId().toString(), currentVersion, toPullItem(ganadero), conflictResolutionV2Enabled);
        }

        MutationResult<Ganadero> mutation = ganaderoService.syncUpdateStatus(
                ganaderoId,
                syncPayloadMapper.readGanaderoActive(operation.payload()),
                operation.operationId(),
                currentUserId);
        return noConflict(operation, mutation.data().getId().toString(), mutation.data().getVersion().intValue());
    }

    private SyncOperationResult handleLotUpsert(SyncOperationRequest operation) {
        UUID lotId = operation.entityId() == null || operation.entityId().isBlank()
                ? operation.operationId()
                : requireUuid(operation.entityId(), "LOT_ID_INVALID");
        SyncPayloadMapper.HerdLotPayload payload = syncPayloadMapper.toHerdLotPayload(operation.payload());
        HerdLot lot = herdLotRepository.findByIdOptional(lotId).orElseGet(HerdLot::new);
        boolean isNewLot = lot.getLotId() == null;
        lot.setLotId(lotId);
        lot.setName(payload.name());
        lot.setDescription(payload.description());
        lot.setActive(payload.active());
        lot.setOperationId(operation.operationId());
        if (isNewLot) {
            herdLotRepository.persist(lot);
        }
        herdLotRepository.flush();
        return noConflict(operation, lot.getLotId().toString(), lot.getVersion().intValue());
    }

    private SyncOperationResult handleLotAssignmentUpsert(SyncOperationRequest operation) {
        UUID assignmentId = operation.entityId() == null || operation.entityId().isBlank()
                ? operation.operationId()
                : requireUuid(operation.entityId(), "LOT_ASSIGNMENT_ID_INVALID");
        SyncPayloadMapper.HerdLotAssignmentPayload payload = syncPayloadMapper.toHerdLotAssignmentPayload(operation.payload());
        Animal animal = animalRepository.findByUuid(payload.animalUuid())
                .orElseThrow(() -> new BusinessException("LOT_ASSIGNMENT_ANIMAL_NOT_FOUND", "No encontramos el animal solicitado.", jakarta.ws.rs.core.Response.Status.NOT_FOUND));
        HerdLot lot = herdLotRepository.findByIdOptional(payload.lotId())
                .orElseThrow(() -> new BusinessException("LOT_ASSIGNMENT_LOT_NOT_FOUND", "No encontramos el lote solicitado.", jakarta.ws.rs.core.Response.Status.NOT_FOUND));

        if (herdLotAssignmentRepository.hasOverlap(payload.animalUuid(), payload.fromDate(), payload.toDate(), assignmentId)) {
            return validationError(operation, "LOT_ASSIGNMENT_OVERLAP", true);
        }

        HerdLotAssignment assignment = herdLotAssignmentRepository.findByIdOptional(assignmentId).orElseGet(HerdLotAssignment::new);
        boolean isNewAssignment = assignment.getAssignmentId() == null;
        assignment.setAssignmentId(assignmentId);
        assignment.setAnimal(animal);
        assignment.setLot(lot);
        assignment.setFromDate(payload.fromDate());
        assignment.setToDate(payload.toDate());
        assignment.setOperationId(operation.operationId());
        if (isNewAssignment) {
            herdLotAssignmentRepository.persist(assignment);
        }
        herdLotAssignmentRepository.flush();
        return noConflict(operation, assignment.getAssignmentId().toString(), assignment.getVersion().intValue());
    }

    private SyncOperationResult handleProductivityLedgerUpsert(SyncOperationRequest operation) {
        SyncPayloadMapper.HerdProductivityLedgerPayload payload = syncPayloadMapper.toHerdProductivityLedgerPayload(operation.payload());
        HerdProductivityLedger current = herdProductivityLedgerRepository.findByIdentityKey(payload.identityKey()).orElse(null);
        if (current != null && !shouldReplaceByTimestamp(operation, current.getUpdatedAt(), current.getOperationId())) {
            return noConflict(operation, current.getEntryId().toString(), current.getVersion().intValue());
        }

        Animal animal = animalRepository.findByUuid(payload.animalUuid())
                .orElseThrow(() -> new BusinessException("PRODUCTIVITY_LEDGER_ANIMAL_NOT_FOUND", "No encontramos el animal solicitado.", jakarta.ws.rs.core.Response.Status.NOT_FOUND));
        HerdLot lot = herdLotRepository.findByIdOptional(payload.lotId())
                .orElseThrow(() -> new BusinessException("PRODUCTIVITY_LEDGER_LOT_NOT_FOUND", "No encontramos el lote solicitado.", jakarta.ws.rs.core.Response.Status.NOT_FOUND));
        HerdProductivityLedger entry = current == null ? new HerdProductivityLedger() : current;
        boolean isNewEntry = entry.getEntryId() == null;
        entry.setEntryId(entry.getEntryId() == null ? operation.operationId() : entry.getEntryId());
        entry.setAnimal(animal);
        entry.setLot(lot);
        entry.setPeriodKey(payload.periodKey());
        entry.setMetricType(payload.metricType());
        entry.setValue(payload.value());
        entry.setIdentityKey(payload.identityKey());
        entry.setOperationId(operation.operationId());
        setEntityUpdatedAt(entry, operation.clientUpdatedAt());
        if (isNewEntry) {
            herdProductivityLedgerRepository.persist(entry);
        }
        herdProductivityLedgerRepository.flush();
        return noConflict(operation, entry.getEntryId().toString(), entry.getVersion().intValue());
    }

    private SyncOperationResult handleCostLedgerUpsert(SyncOperationRequest operation) {
        SyncPayloadMapper.HerdCostLedgerPayload payload = syncPayloadMapper.toHerdCostLedgerPayload(operation.payload());
        HerdCostLedger current = herdCostLedgerRepository.findByIdentityKey(payload.identityKey()).orElse(null);
        if (current != null && !shouldReplaceByTimestamp(operation, current.getUpdatedAt(), current.getOperationId())) {
            return noConflict(operation, current.getEntryId().toString(), current.getVersion().intValue());
        }

        HerdLot lot = herdLotRepository.findByIdOptional(payload.lotId())
                .orElseThrow(() -> new BusinessException("COST_LEDGER_LOT_NOT_FOUND", "No encontramos el lote solicitado.", jakarta.ws.rs.core.Response.Status.NOT_FOUND));
        HerdCostLedger entry = current == null ? new HerdCostLedger() : current;
        boolean isNewEntry = entry.getEntryId() == null;
        entry.setEntryId(entry.getEntryId() == null ? operation.operationId() : entry.getEntryId());
        entry.setLot(lot);
        entry.setPeriodKey(payload.periodKey());
        entry.setCategory(payload.category());
        entry.setSource(payload.source());
        entry.setAmount(payload.amount());
        entry.setCurrency(payload.currency());
        entry.setIdentityKey(payload.identityKey());
        entry.setOperationId(operation.operationId());
        setEntityUpdatedAt(entry, operation.clientUpdatedAt());
        if (isNewEntry) {
            herdCostLedgerRepository.persist(entry);
        }
        herdCostLedgerRepository.flush();
        return noConflict(operation, entry.getEntryId().toString(), entry.getVersion().intValue());
    }

    private SyncOperationResult handleAnimalEventCreate(SyncOperationRequest operation, UUID currentUserId) {
        AnimalEventRequest request = syncPayloadMapper.toAnimalEventRequest(operation.payload(), operation.clientCreatedAt());
        AnimalEvent event = animalEventService.create(request, currentUserId);
        return noConflict(operation, event.getOperationId().toString(), 0);
    }

    private SyncOperationResult handleAnimalEventLogCreate(SyncOperationRequest operation, UUID currentUserId) {
        Map<String, Object> canonical = syncPayloadMapper.toAnimalEventLogPayload(operation.entityType(), operation.payload());
        UUID operationId = syncPayloadMapper.parseUuid(String.valueOf(canonical.get("operationId")));
        AnimalEventLog existing = operationId == null ? null : animalEventLogRepository.findByOperationId(operationId).orElse(null);
        if (existing != null) {
            return noConflict(operation, existing.getOperationId().toString(), 0);
        }

        String category = String.valueOf(canonical.get("eventCategory"));
        return switch (AnimalEventCategory.valueOf(category)) {
            case GENERAL -> {
                AnimalEventRequest request = syncPayloadMapper.toAnimalEventRequest(canonical, operation.clientCreatedAt());
                AnimalEvent event = animalEventService.create(request, currentUserId);
                yield noConflict(operation, event.getOperationId().toString(), 0);
            }
            case HEALTH -> {
                AnimalHealthEventRequest request = syncPayloadMapper.toAnimalHealthEventRequest(canonical, operation.clientCreatedAt());
                AnimalHealthEvent event = animalHealthEventService.create(request, currentUserId);
                yield noConflict(operation, event.getOperationId().toString(), 0);
            }
            case REPRODUCTION -> {
                AnimalReproductionEventRequest request = syncPayloadMapper.toAnimalReproductionEventRequest(canonical, operation.clientCreatedAt());
                AnimalReproductionEvent event = animalReproductionEventService.create(request, currentUserId);
                yield noConflict(operation, event.getOperationId().toString(), 0);
            }
        };
    }

    private SyncOperationResult handleAnimalHealthEventCreate(SyncOperationRequest operation, UUID currentUserId) {
        AnimalHealthEventRequest request = syncPayloadMapper.toAnimalHealthEventRequest(operation.payload(), operation.clientCreatedAt());
        AnimalHealthEvent event = animalHealthEventService.create(request, currentUserId);
        return noConflict(operation, event.getOperationId().toString(), 0);
    }

    private SyncOperationResult handleAnimalReproductionEventCreate(SyncOperationRequest operation, UUID currentUserId) {
        AnimalReproductionEventRequest request = syncPayloadMapper.toAnimalReproductionEventRequest(operation.payload(), operation.clientCreatedAt());
        AnimalReproductionEvent event = animalReproductionEventService.create(request, currentUserId);
        return noConflict(operation, event.getOperationId().toString(), 0);
    }

    private SyncOperationResult handleAnimalImageCreate(SyncOperationRequest operation) {
        AnimalImageRequest request = syncPayloadMapper.toAnimalImageRequest(operation.payload(), operation.clientCreatedAt());
        AnimalImage image = animalImageService.create(request);
        return noConflict(operation, image.getImageId().toString(), 0);
    }

    private SyncOperationResult validationError(SyncOperationRequest operation, String reason, boolean conflictResolutionV2Enabled) {
        return new SyncOperationResult(
                operation.operationId(),
                operation.entityType(),
                operation.entityId(),
                "validation_error",
                null,
                buildConflictResponse(operation, operation.entityId(), operation.baseVersion(), null, reason, null, conflictResolutionV2Enabled));
    }

    private SyncOperationResult versionConflict(
            SyncOperationRequest operation,
            String entityId,
            Integer serverVersion,
            Map<String, Object> serverState,
            boolean conflictResolutionV2Enabled) {
        return new SyncOperationResult(
                operation.operationId(),
                operation.entityType(),
                entityId,
                "version_conflict",
                serverVersion,
                buildConflictResponse(operation, entityId, operation.baseVersion(), serverVersion, VERSION_CONFLICT_REASON, serverState, conflictResolutionV2Enabled));
    }

    private SyncOperationResult noConflict(SyncOperationRequest operation, String entityId, Integer serverVersion) {
        return new SyncOperationResult(
                operation.operationId(),
                operation.entityType(),
                entityId,
                "no_conflict",
                serverVersion,
                null);
    }

    private SyncOperationResult persistReceipt(SyncOperationRequest operation, SyncOperationResult result) {
        return persistReceipt(operation, result, null);
    }

    private SyncOperationResult persistReceipt(SyncOperationRequest operation, SyncOperationResult result, UUID actorUserId) {
        return persistReceipt(syncOperationReceiptRepository.findById(operation.operationId()), operation, result, actorUserId);
    }

    private SyncOperationResult persistReceipt(SyncOperationReceipt receipt, SyncOperationRequest operation, SyncOperationResult result) {
        return persistReceipt(receipt, operation, result, null);
    }

    private SyncOperationResult persistReceipt(SyncOperationReceipt receipt, SyncOperationRequest operation, SyncOperationResult result, UUID actorUserId) {
        boolean isNewReceipt = receipt == null;
        if (receipt == null) {
            receipt = new SyncOperationReceipt();
        }

        receipt.setOperationId(operation.operationId());
        receipt.setEntityType(operation.entityType().name());
        receipt.setEntityId(result.entityId());
        receipt.setOperationType(operation.opType().name());
        receipt.setClassification(result.classification());
        receipt.setServerVersion(result.serverVersion());
        receipt.setClientVersion(null);
        receipt.setReason(null);
        receipt.setResolutionHint(null);
        receipt.setServerStateJson(null);

        if (result.conflict() != null) {
            receipt.setClientVersion(result.conflict().clientVersion());
            receipt.setReason(result.conflict().reason());
            receipt.setResolutionHint(result.conflict().resolutionHint());
            if (result.conflict().serverState() != null) {
                try {
                    receipt.setServerStateJson(objectMapper.writeValueAsString(result.conflict().serverState()));
                } catch (Exception exception) {
                    throw new IllegalStateException("Could not serialize sync conflict server state.", exception);
                }
            }
        }

        try {
            receipt.setPayloadJson(objectMapper.writeValueAsString(operation.payload()));
        } catch (Exception exception) {
            throw new IllegalStateException("Could not serialize sync operation payload.", exception);
        }

        if (isNewReceipt) {
            syncOperationReceiptRepository.persist(receipt);
        }
        recordDetectedConflict(operation, result, actorUserId);
        return result;
    }

    private SyncOperationResult toResult(SyncOperationReceipt receipt, boolean conflictResolutionV2Enabled) {
        Object serverState = null;
        if (receipt.getServerStateJson() != null) {
            try {
                serverState = objectMapper.readValue(receipt.getServerStateJson(), new TypeReference<Map<String, Object>>() {});
            } catch (Exception exception) {
                throw new IllegalStateException("Could not deserialize sync conflict server state.", exception);
            }
        }

        Map<String, Object> payload = null;
        if (receipt.getPayloadJson() != null) {
            try {
                payload = objectMapper.readValue(receipt.getPayloadJson(), new TypeReference<Map<String, Object>>() {});
            } catch (Exception exception) {
                throw new IllegalStateException("Could not deserialize sync operation payload.", exception);
            }
        }

        SyncConflictResponse conflict = receipt.getReason() == null && receipt.getResolutionHint() == null && receipt.getClientVersion() == null
                ? null
                : buildConflictResponse(
                        SyncEntityType.valueOf(receipt.getEntityType()),
                        receipt.getOperationType() == null ? null : SyncOperationType.valueOf(receipt.getOperationType()),
                        receipt.getEntityId(),
                        receipt.getClientVersion(),
                        receipt.getServerVersion(),
                        receipt.getReason(),
                        receipt.getResolutionHint(),
                        serverState,
                        payload,
                        conflictResolutionV2Enabled);

        return new SyncOperationResult(
                receipt.getOperationId(),
                SyncEntityType.valueOf(receipt.getEntityType()),
                receipt.getEntityId(),
                receipt.getClassification(),
                receipt.getServerVersion(),
                conflict);
    }

    private void recordDetectedConflict(SyncOperationRequest operation, SyncOperationResult result, UUID actorUserId) {
        if (result.conflict() == null || !List.of("version_conflict", "validation_error").contains(result.classification())) {
            return;
        }

        SyncConflictAuditLedger detected = new SyncConflictAuditLedger();
        detected.setOperationId(operation.operationId());
        detected.setEntityType(operation.entityType().name());
        detected.setEntityId(result.entityId());
        detected.setOperationType(operation.opType().name());
        detected.setEventType("DETECTED");
        detected.setReason(result.conflict().reason());
        detected.setActorUserId(actorUserId);
        detected.setPolicyKey(result.conflict().policyKey() == null
                ? syncPayloadMapper.buildPolicyKey(operation.entityType(), operation.opType())
                : result.conflict().policyKey());
        detected.setRetentionExpiresAt(LocalDateTime.now().plusDays(CONFLICT_LEDGER_TTL_DAYS));
        syncConflictAuditLedgerRepository.persist(detected);
    }

    private SyncConflictListItemResponse toConflictItem(SyncOperationReceipt receipt) {
        List<SyncConflictAuditLedger> auditTrail = syncConflictAuditLedgerRepository.listByOperationId(receipt.getOperationId());
        SyncOperationResult result = toResult(receipt, true);
        return new SyncConflictListItemResponse(
                receipt.getOperationId(),
                result.entityType(),
                result.entityId(),
                SyncOperationType.valueOf(receipt.getOperationType()),
                result.classification(),
                result.conflict(),
                auditTrail.stream()
                        .map(entry -> new SyncConflictAuditEntryResponse(
                                entry.getEventType(),
                                entry.getDecision(),
                                entry.getResultStatus(),
                                entry.getReason(),
                                entry.getActorUserId() == null ? null : entry.getActorUserId().toString(),
                                entry.getCreatedAt().atOffset(ZoneOffset.UTC).toString()))
                        .toList());
    }

    private boolean isResolved(UUID operationId) {
        List<SyncConflictAuditLedger> entries = syncConflictAuditLedgerRepository.listByOperationId(operationId);
        return !entries.isEmpty() && "RESOLVED".equals(entries.getLast().getEventType());
    }

    private boolean shouldReplayResolvedConflict(SyncOperationReceipt existingReceipt) {
        List<SyncConflictAuditLedger> entries = syncConflictAuditLedgerRepository.listByOperationId(existingReceipt.getOperationId());
        if (entries.isEmpty()) {
            return false;
        }

        SyncConflictAuditLedger latest = entries.getLast();
        return "RESOLVED".equals(latest.getEventType()) && "pending".equals(latest.getResultStatus());
    }

    private SyncConflictResponse buildConflictResponse(
            SyncOperationRequest operation,
            String entityId,
            Integer clientVersion,
            Integer serverVersion,
            String reason,
            Map<String, Object> serverState,
            boolean conflictResolutionV2Enabled) {
        return buildConflictResponse(
                operation.entityType(),
                operation.opType(),
                entityId,
                clientVersion,
                serverVersion,
                reason,
                conflictResolutionV2Enabled ? V2_RESOLUTION_HINT : V1_RESOLUTION_HINT,
                serverState,
                operation.payload(),
                conflictResolutionV2Enabled);
    }

    private SyncConflictResponse buildConflictResponse(
            SyncEntityType entityType,
            SyncOperationType operationType,
            String entityId,
            Integer clientVersion,
            Integer serverVersion,
            String reason,
            String resolutionHint,
            Object serverState,
            Map<String, Object> payload,
            boolean conflictResolutionV2Enabled) {
        if (!conflictResolutionV2Enabled || operationType == null) {
            return new SyncConflictResponse(
                    entityId,
                    clientVersion,
                    serverVersion,
                    reason,
                    resolutionHint == null ? V1_RESOLUTION_HINT : resolutionHint,
                    serverState,
                    serverVersion,
                    null,
                    null,
                    null,
                    null);
        }

        ResolutionPolicyResponse policy = syncPayloadMapper.resolveConflictPolicy(entityType, operationType);
        List<ConflictDiffField> diffFields = serverState instanceof Map<?, ?> serverStateMap
                ? buildDiffFields(payload, castMap(serverStateMap))
                : List.of();
        return new SyncConflictResponse(
                entityId,
                clientVersion,
                serverVersion,
                reason,
                resolutionHint == null ? V2_RESOLUTION_HINT : resolutionHint,
                serverState,
                serverVersion,
                diffFields,
                policy,
                policy == null ? List.of() : policy.allowedActions(),
                policy == null ? null : policy.policyKey());
    }

    private List<ConflictDiffField> buildDiffFields(Map<String, Object> payload, Map<String, Object> serverState) {
        if (payload == null || payload.isEmpty() || serverState == null) {
            return List.of();
        }

        List<ConflictDiffField> fields = new ArrayList<>();
        for (Map.Entry<String, Object> entry : payload.entrySet()) {
            Object serverValue = serverState.get(entry.getKey());
            if (!Objects.equals(entry.getValue(), serverValue)) {
                fields.add(new ConflictDiffField(entry.getKey(), entry.getValue(), serverValue, resolveSeverity(entry.getKey())));
            }
        }
        return fields;
    }

    private String resolveSeverity(String path) {
        return switch (path) {
            case "ownerGanaderoId", "status", "active", "category", "animalUuid", "type", "healthEventType", "reproductionEventType", "businessIdentifier" -> "high";
            case "arete", "marca", "tatuaje", "name", "weightKg", "color", "description", "breedUuid", "occurredAt", "capturedAt" -> "medium";
            default -> "low";
        };
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> castMap(Map<?, ?> source) {
        return (Map<String, Object>) source;
    }

    private Map<String, Object> toPullItem(Animal animal) {
        Map<String, Object> item = new java.util.LinkedHashMap<>();
        item.put("uuid", animal.getUuid().toString());
        item.put("ownerGanaderoId", animal.getOwnerGanadero().getId().toString());
        item.put("arete", animal.getArete());
        item.put("marca", animal.getMarca());
        item.put("tatuaje", animal.getTatuaje());
        item.put("category", animal.getCategory().name());
        item.put("active", animal.getActive());
        item.put("admissionDate", animal.getAdmissionDate());
        item.put("weightKg", animal.getWeightKg());
        item.put("color", animal.getColor());
        item.put("description", animal.getDescription());
        item.put("breedUuid", animal.getBreed() == null ? null : animal.getBreed().getUuid().toString());
        item.put("breedName", animal.getBreed() == null ? null : animal.getBreed().getNombre());
        item.put("createdAt", animal.getCreatedAt().atOffset(ZoneOffset.UTC));
        item.put("version", animal.getVersion().intValue());
        item.put("updatedAt", animal.getUpdatedAt().atOffset(ZoneOffset.UTC));
        item.put("lastSyncedAt", animal.getLastSyncedAt() == null ? null : animal.getLastSyncedAt().atOffset(ZoneOffset.UTC));
        return item;
    }

    private Map<String, Object> toPullItem(User user) {
        Map<String, Object> item = new java.util.LinkedHashMap<>();
        item.put("id", user.getId().toString());
        item.put("username", user.getUsername());
        item.put("email", user.getEmail());
        item.put("displayName", user.getDisplayName());
        item.put("role", user.getRole().name());
        item.put("status", user.getStatus().name());
        item.put("version", user.getVersion().intValue());
        item.put("createdAt", user.getCreatedAt().atOffset(ZoneOffset.UTC));
        item.put("updatedAt", user.getUpdatedAt().atOffset(ZoneOffset.UTC));
        item.put("lastSyncedAt", user.getLastSyncedAt() == null ? null : user.getLastSyncedAt().atOffset(ZoneOffset.UTC));
        return item;
    }

    private Map<String, Object> toPullItem(Ganadero ganadero) {
        Map<String, Object> item = new java.util.LinkedHashMap<>();
        item.put("id", ganadero.getId().toString());
        item.put("businessIdentifier", ganadero.getBusinessIdentifier());
        item.put("name", ganadero.getName());
        item.put("active", ganadero.isActive());
        item.put("version", ganadero.getVersion().intValue());
        item.put("createdAt", ganadero.getCreatedAt().atOffset(ZoneOffset.UTC));
        item.put("updatedAt", ganadero.getUpdatedAt().atOffset(ZoneOffset.UTC));
        item.put("lastSyncedAt", ganadero.getLastSyncedAt() == null ? null : ganadero.getLastSyncedAt().atOffset(ZoneOffset.UTC));
        return item;
    }

    private Map<String, Object> toPullItem(HerdLot lot) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", lot.getLotId().toString());
        item.put("name", lot.getName());
        item.put("description", lot.getDescription());
        item.put("active", lot.getActive());
        item.put("version", lot.getVersion().intValue());
        item.put("updatedAt", lot.getUpdatedAt().atOffset(ZoneOffset.UTC));
        item.put("createdAt", lot.getCreatedAt().atOffset(ZoneOffset.UTC));
        return item;
    }

    private Map<String, Object> toPullItem(HerdLotAssignment assignment) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", assignment.getAssignmentId().toString());
        item.put("animalUuid", assignment.getAnimal().getUuid().toString());
        item.put("lotId", assignment.getLot().getLotId().toString());
        item.put("fromDate", assignment.getFromDate().toString());
        item.put("toDate", assignment.getToDate() == null ? null : assignment.getToDate().toString());
        item.put("version", assignment.getVersion().intValue());
        item.put("updatedAt", assignment.getUpdatedAt().atOffset(ZoneOffset.UTC));
        item.put("createdAt", assignment.getCreatedAt().atOffset(ZoneOffset.UTC));
        return item;
    }

    private Map<String, Object> toPullItem(HerdProductivityLedger entry) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", entry.getEntryId().toString());
        item.put("animalUuid", entry.getAnimal().getUuid().toString());
        item.put("lotId", entry.getLot().getLotId().toString());
        item.put("periodKey", entry.getPeriodKey());
        item.put("metricType", entry.getMetricType());
        item.put("value", entry.getValue());
        item.put("identityKey", entry.getIdentityKey());
        item.put("version", entry.getVersion().intValue());
        item.put("updatedAt", entry.getUpdatedAt().atOffset(ZoneOffset.UTC));
        item.put("createdAt", entry.getCreatedAt().atOffset(ZoneOffset.UTC));
        return item;
    }

    private Map<String, Object> toPullItem(HerdCostLedger entry) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", entry.getEntryId().toString());
        item.put("lotId", entry.getLot().getLotId().toString());
        item.put("periodKey", entry.getPeriodKey());
        item.put("category", entry.getCategory());
        item.put("source", entry.getSource());
        item.put("amount", entry.getAmount());
        item.put("currency", entry.getCurrency());
        item.put("identityKey", entry.getIdentityKey());
        item.put("version", entry.getVersion().intValue());
        item.put("updatedAt", entry.getUpdatedAt().atOffset(ZoneOffset.UTC));
        item.put("createdAt", entry.getCreatedAt().atOffset(ZoneOffset.UTC));
        return item;
    }

    private Map<String, Object> toPullItem(AnimalEventLog event) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("id", event.getOperationId().toString());
        item.put("eventId", event.getEventId().toString());
        item.put("animalUuid", event.getAnimal() == null ? null : event.getAnimal().getUuid().toString());
        item.put("eventCategory", event.getEventCategory().name());
        item.put("eventType", event.getEventType());
        item.put("occurredAt", event.getOccurredAt().atOffset(ZoneOffset.UTC));
        item.put("notes", event.getNotes());
        item.put("performedByUserId", event.getPerformedByUserId().toString());
        item.put("sourceChannel", event.getSourceChannel());
        item.put("operationId", event.getOperationId().toString());
        item.put("metadata", readEventLogMetadata(event));
        item.put("clientCreatedAt", event.getClientCreatedAt().atOffset(ZoneOffset.UTC));
        item.put("createdAt", event.getCreatedAt().atOffset(ZoneOffset.UTC));
        item.put("updatedAt", event.getUpdatedAt().atOffset(ZoneOffset.UTC));
        return item;
    }

    private Map<String, Object> toLegacyAnimalEventPullItem(AnimalEventLog event) {
        return animalEventMapper.toPullItem(animalEventMapper.toAnimalEvent(event));
    }

    private Map<String, Object> toLegacyAnimalHealthEventPullItem(AnimalEventLog event) {
        return animalHealthEventMapper.toPullItem(animalHealthEventMapper.toAnimalHealthEvent(event));
    }

    private Map<String, Object> toLegacyAnimalReproductionEventPullItem(AnimalEventLog event) {
        return animalReproductionEventMapper.toPullItem(animalReproductionEventMapper.toAnimalReproductionEvent(event));
    }

    private Map<String, Object> readEventLogMetadata(AnimalEventLog event) {
        return switch (event.getEventCategory()) {
            case GENERAL -> animalEventMapper.readMetadataJson(event.getMetadataJson());
            case HEALTH -> animalHealthEventMapper.readMetadataJson(event.getMetadataJson());
            case REPRODUCTION -> animalReproductionEventMapper.readMetadataJson(event.getMetadataJson());
        };
    }

    private <T> PullSyncResponse buildPullResponse(
            SyncEntityType entityType,
            List<T> changedEntities,
            OffsetDateTime previousCursorUpdatedAt,
            String previousCursorId,
            java.util.function.Function<T, PullCursorItem> mapper) {
        boolean hasMore = changedEntities.size() > PULL_PAGE_SIZE;
        List<T> page = hasMore ? changedEntities.subList(0, PULL_PAGE_SIZE) : changedEntities;
        List<PullCursorItem> cursorItems = page.stream().map(mapper).toList();

        return new PullSyncResponse(
                entityType,
                cursorItems.stream().map(PullCursorItem::payload).toList(),
                resolveNextCursor(entityType, previousCursorUpdatedAt, previousCursorId, cursorItems),
                hasMore);
    }

    private SyncCursorResponse resolveNextCursor(
            SyncEntityType entityType,
            OffsetDateTime previousCursorUpdatedAt,
            String previousCursorId,
            List<PullCursorItem> page) {
        if (page.isEmpty()) {
            return new SyncCursorResponse(
                    entityType,
                    previousCursorUpdatedAt == null ? OffsetDateTime.now(ZoneOffset.UTC) : previousCursorUpdatedAt,
                    previousCursorId == null || previousCursorId.isBlank() ? entityType.name().toLowerCase() + "-cursor" : previousCursorId,
                    OffsetDateTime.now(ZoneOffset.UTC));
        }

        PullCursorItem lastItem = page.getLast();
        return new SyncCursorResponse(
                entityType,
                lastItem.updatedAt(),
                lastItem.cursorId(),
                OffsetDateTime.now(ZoneOffset.UTC));
    }

    private UUID requireUuid(String rawUuid, String reason) {
        UUID uuid = syncPayloadMapper.parseUuid(rawUuid);
        if (uuid == null) {
            throw new IllegalArgumentException(reason);
        }
        return uuid;
    }

    private boolean shouldReplaceByTimestamp(SyncOperationRequest operation, LocalDateTime existingUpdatedAt, UUID existingOperationId) {
        LocalDateTime incoming = operation.clientUpdatedAt().withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime();
        int comparison = incoming.truncatedTo(ChronoUnit.MILLIS).compareTo(existingUpdatedAt.truncatedTo(ChronoUnit.MILLIS));
        if (comparison != 0) {
            return comparison > 0;
        }
        return operation.operationId().toString().compareTo(existingOperationId.toString()) > 0;
    }

    private void setEntityUpdatedAt(HerdProductivityLedger entry, OffsetDateTime updatedAt) {
        LocalDateTime normalized = updatedAt.withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime();
        entry.setCreatedAt(entry.getCreatedAt() == null ? normalized : entry.getCreatedAt());
        entry.setUpdatedAt(normalized);
    }

    private void setEntityUpdatedAt(HerdCostLedger entry, OffsetDateTime updatedAt) {
        LocalDateTime normalized = updatedAt.withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime();
        entry.setCreatedAt(entry.getCreatedAt() == null ? normalized : entry.getCreatedAt());
        entry.setUpdatedAt(normalized);
    }

    private record PullCursorItem(Map<String, Object> payload, OffsetDateTime updatedAt, String cursorId) {
    }

}

package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.SyncOperationReceipt;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.SyncOperationReceiptRepository;
import bo.pasorapa.hato.service.dto.sync.PullSyncResponse;
import bo.pasorapa.hato.service.dto.sync.PushSyncRequest;
import bo.pasorapa.hato.service.dto.sync.PushSyncResponse;
import bo.pasorapa.hato.service.dto.sync.SyncConflictResponse;
import bo.pasorapa.hato.service.dto.sync.SyncCursorResponse;
import bo.pasorapa.hato.service.dto.sync.SyncEntityType;
import bo.pasorapa.hato.service.dto.sync.SyncOperationRequest;
import bo.pasorapa.hato.service.dto.sync.SyncOperationResult;
import bo.pasorapa.hato.service.dto.sync.SyncOperationType;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class SyncService {

    private static final int PULL_PAGE_SIZE = 100;

    private final AnimalRepository animalRepository;
    private final SyncOperationReceiptRepository syncOperationReceiptRepository;
    private final ObjectMapper objectMapper;

    public SyncService(
            AnimalRepository animalRepository,
            SyncOperationReceiptRepository syncOperationReceiptRepository,
            ObjectMapper objectMapper) {
        this.animalRepository = animalRepository;
        this.syncOperationReceiptRepository = syncOperationReceiptRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public PushSyncResponse push(PushSyncRequest request) {
        List<SyncOperationResult> results = request.operations().stream()
                .map(this::processOperation)
                .toList();

        return new PushSyncResponse(results);
    }

    public PullSyncResponse pull(SyncEntityType entityType, OffsetDateTime cursorUpdatedAt, String cursorId) {
        if (entityType != SyncEntityType.ANIMAL) {
            return emptyPull(entityType, cursorUpdatedAt, cursorId);
        }

        LocalDateTime effectiveCursorUpdatedAt = cursorUpdatedAt == null
                ? null
                : cursorUpdatedAt.withOffsetSameInstant(ZoneOffset.UTC).toLocalDateTime();
        UUID effectiveCursorId = parseUuid(cursorId);

        List<Animal> changedAnimals = animalRepository.listChangedSince(effectiveCursorUpdatedAt, effectiveCursorId, PULL_PAGE_SIZE + 1);
        boolean hasMore = changedAnimals.size() > PULL_PAGE_SIZE;
        List<Animal> page = hasMore ? changedAnimals.subList(0, PULL_PAGE_SIZE) : changedAnimals;
        List<Map<String, Object>> items = page.stream().map(this::toPullItem).toList();

        SyncCursorResponse nextCursor = resolveNextCursor(entityType, cursorUpdatedAt, cursorId, page);

        return new PullSyncResponse(
                entityType,
                items,
                nextCursor,
                hasMore
        );
    }

    private PullSyncResponse emptyPull(SyncEntityType entityType, OffsetDateTime cursorUpdatedAt, String cursorId) {
        OffsetDateTime effectiveCursorUpdatedAt = cursorUpdatedAt == null
                ? OffsetDateTime.now(ZoneOffset.UTC)
                : cursorUpdatedAt;
        String effectiveCursorId = cursorId == null || cursorId.isBlank() ? entityType.name().toLowerCase() + "-cursor" : cursorId;

        return new PullSyncResponse(
                entityType,
                List.of(),
                new SyncCursorResponse(entityType, effectiveCursorUpdatedAt, effectiveCursorId, OffsetDateTime.now(ZoneOffset.UTC)),
                false);
    }

    private SyncOperationResult processOperation(SyncOperationRequest operation) {
        SyncOperationReceipt existingReceipt = syncOperationReceiptRepository.findById(operation.operationId());
        if (existingReceipt != null) {
            return toResult(existingReceipt);
        }

        if (operation.entityType() != SyncEntityType.ANIMAL) {
            return persistReceipt(operation, validationError(operation, "Unsupported entity type for sync foundation V1."));
        }

        return switch (operation.opType()) {
            case UPDATE -> persistReceipt(operation, handleAnimalUpdate(operation));
            default -> persistReceipt(operation, validationError(operation, "Unsupported operation type for animal sync foundation V1."));
        };
    }

    private SyncOperationResult handleAnimalUpdate(SyncOperationRequest operation) {
        UUID entityUuid = parseUuid(operation.entityId());
        if (entityUuid == null) {
            return validationError(operation, "Invalid animal uuid.");
        }

        Animal animal = animalRepository.findByUuid(entityUuid)
                .orElse(null);
        if (animal == null) {
            return validationError(operation, "Animal not found for sync update.");
        }

        int currentVersion = animal.getVersion().intValue();
        if (!operation.baseVersion().equals(currentVersion)) {
            return new SyncOperationResult(
                    operation.operationId(),
                    operation.entityType(),
                    operation.entityId(),
                    "version_conflict",
                    currentVersion,
                    new SyncConflictResponse(
                            operation.entityId(),
                            operation.baseVersion(),
                            currentVersion,
                            "Stale version detected for offline foundation contract.",
                            "manual_refresh",
                            toPullItem(animal)));
        }

        applyAnimalPayload(animal, operation.payload());
        animal.setLastSyncedAt(LocalDateTime.now());
        animalRepository.flush();

        return new SyncOperationResult(
                operation.operationId(),
                operation.entityType(),
                operation.entityId(),
                "no_conflict",
                animal.getVersion().intValue(),
                null);
    }

    private SyncOperationResult validationError(SyncOperationRequest operation, String reason) {
        return new SyncOperationResult(
                operation.operationId(),
                operation.entityType(),
                operation.entityId(),
                "validation_error",
                null,
                new SyncConflictResponse(
                        operation.entityId(),
                        operation.baseVersion(),
                        null,
                        reason,
                        "manual_refresh",
                        null));
    }

    private SyncOperationResult persistReceipt(SyncOperationRequest operation, SyncOperationResult result) {
        SyncOperationReceipt receipt = new SyncOperationReceipt();
        receipt.setOperationId(operation.operationId());
        receipt.setEntityType(operation.entityType().name());
        receipt.setEntityId(operation.entityId());
        receipt.setClassification(result.classification());
        receipt.setServerVersion(result.serverVersion());

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

        syncOperationReceiptRepository.persist(receipt);
        return result;
    }

    private SyncOperationResult toResult(SyncOperationReceipt receipt) {
        Object serverState = null;
        if (receipt.getServerStateJson() != null) {
            try {
                serverState = objectMapper.readValue(receipt.getServerStateJson(), new TypeReference<Map<String, Object>>() {});
            } catch (Exception exception) {
                throw new IllegalStateException("Could not deserialize sync conflict server state.", exception);
            }
        }

        SyncConflictResponse conflict = receipt.getReason() == null && receipt.getResolutionHint() == null && receipt.getClientVersion() == null
                ? null
                : new SyncConflictResponse(
                        receipt.getEntityId(),
                        receipt.getClientVersion(),
                        receipt.getServerVersion(),
                        receipt.getReason(),
                        receipt.getResolutionHint(),
                        serverState);

        return new SyncOperationResult(
                receipt.getOperationId(),
                SyncEntityType.valueOf(receipt.getEntityType()),
                receipt.getEntityId(),
                receipt.getClassification(),
                receipt.getServerVersion(),
                conflict);
    }

    private Map<String, Object> toPullItem(Animal animal) {
        Map<String, Object> item = new java.util.LinkedHashMap<>();
        item.put("id", animal.getId());
        item.put("uuid", animal.getUuid().toString());
        item.put("code", animal.getCode());
        item.put("tag", animal.getTag());
        item.put("category", animal.getCategory().name());
        item.put("active", animal.getActive());
        item.put("admissionDate", animal.getAdmissionDate());
        item.put("weightKg", animal.getWeightKg());
        item.put("version", animal.getVersion().intValue());
        item.put("updatedAt", animal.getUpdatedAt().atOffset(ZoneOffset.UTC));
        item.put("lastSyncedAt", animal.getLastSyncedAt() == null ? null : animal.getLastSyncedAt().atOffset(ZoneOffset.UTC));
        return item;
    }

    private SyncCursorResponse resolveNextCursor(
            SyncEntityType entityType,
            OffsetDateTime previousCursorUpdatedAt,
            String previousCursorId,
            List<Animal> page) {
        if (page.isEmpty()) {
            return new SyncCursorResponse(
                    entityType,
                    previousCursorUpdatedAt == null ? OffsetDateTime.now(ZoneOffset.UTC) : previousCursorUpdatedAt,
                    previousCursorId == null || previousCursorId.isBlank() ? entityType.name().toLowerCase() + "-cursor" : previousCursorId,
                    OffsetDateTime.now(ZoneOffset.UTC));
        }

        Animal lastAnimal = page.getLast();
        return new SyncCursorResponse(
                entityType,
                lastAnimal.getUpdatedAt().atOffset(ZoneOffset.UTC),
                lastAnimal.getUuid().toString(),
                OffsetDateTime.now(ZoneOffset.UTC));
    }

    private UUID parseUuid(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private void applyAnimalPayload(Animal animal, Map<String, Object> payload) {
        if (payload.containsKey("code") && payload.get("code") instanceof String code) {
            animal.setCode(code);
        }
        if (payload.containsKey("tag") && payload.get("tag") instanceof String tag) {
            animal.setTag(tag);
        }
        if (payload.containsKey("category") && payload.get("category") instanceof String category) {
            animal.setCategory(AnimalCategory.valueOf(category));
        }
        if (payload.containsKey("active") && payload.get("active") instanceof Boolean active) {
            animal.setActive(active);
        }
        if (payload.containsKey("admissionDate") && payload.get("admissionDate") instanceof String admissionDate) {
            animal.setAdmissionDate(LocalDate.parse(admissionDate));
        }
        if (payload.containsKey("weightKg") && payload.get("weightKg") != null) {
            animal.setWeightKg(new BigDecimal(String.valueOf(payload.get("weightKg"))));
        }
    }
}

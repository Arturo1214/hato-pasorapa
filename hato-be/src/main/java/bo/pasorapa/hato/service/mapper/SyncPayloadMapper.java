package bo.pasorapa.hato.service.mapper;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.service.dto.animalhealthevent.AnimalHealthEventRequest;
import bo.pasorapa.hato.service.dto.animalimage.AnimalImageRequest;
import bo.pasorapa.hato.service.dto.animalreproductionevent.AnimalReproductionEventRequest;
import bo.pasorapa.hato.service.dto.AnimalRequest;
import bo.pasorapa.hato.service.dto.animalevent.AnimalEventRequest;
import bo.pasorapa.hato.service.dto.admin.ganadero.GanaderoCreateRequest;
import bo.pasorapa.hato.service.dto.sync.ManualResolutionAction;
import bo.pasorapa.hato.service.dto.sync.ResolutionPolicyResponse;
import bo.pasorapa.hato.service.dto.sync.SyncEntityType;
import bo.pasorapa.hato.service.dto.sync.SyncOperationType;
import jakarta.enterprise.context.ApplicationScoped;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@ApplicationScoped
public class SyncPayloadMapper {

    private static final String POLICY_VERSION = "v2";

    private static final Map<SyncEntityType, Set<SyncOperationType>> OFFLINE_CAPABILITY_MATRIX = Map.ofEntries(
            Map.entry(SyncEntityType.USER, Set.of(SyncOperationType.STATUS_UPDATE)),
            Map.entry(SyncEntityType.GANADERO, Set.of(SyncOperationType.CREATE, SyncOperationType.STATUS_UPDATE)),
            Map.entry(SyncEntityType.ANIMAL, Set.of(SyncOperationType.CREATE, SyncOperationType.UPDATE)),
            Map.entry(SyncEntityType.LOT, Set.of(SyncOperationType.CREATE, SyncOperationType.UPDATE)),
            Map.entry(SyncEntityType.LOT_ASSIGNMENT, Set.of(SyncOperationType.CREATE, SyncOperationType.UPDATE)),
            Map.entry(SyncEntityType.PRODUCTIVITY_LEDGER, Set.of(SyncOperationType.CREATE, SyncOperationType.UPDATE)),
            Map.entry(SyncEntityType.COST_LEDGER, Set.of(SyncOperationType.CREATE, SyncOperationType.UPDATE)),
            Map.entry(SyncEntityType.ANIMAL_EVENT, Set.of(SyncOperationType.CREATE)),
            Map.entry(SyncEntityType.ANIMAL_HEALTH_EVENT, Set.of(SyncOperationType.CREATE)),
            Map.entry(SyncEntityType.ANIMAL_REPRODUCTION_EVENT, Set.of(SyncOperationType.CREATE)),
            Map.entry(SyncEntityType.ANIMAL_IMAGE, Set.of(SyncOperationType.CREATE)));

    private static final Map<PolicyKey, ResolutionPolicyResponse> RESOLUTION_POLICY_MATRIX = Map.ofEntries(
            policyEntry(SyncEntityType.USER, SyncOperationType.STATUS_UPDATE,
                    actions(ManualResolutionAction.ACCEPT_SERVER, ManualResolutionAction.RETRY_LOCAL, ManualResolutionAction.DISCARD_LOCAL),
                    "Refrescá usuarios antes de reintentar para evitar drift operativo."),
            policyEntry(SyncEntityType.GANADERO, SyncOperationType.CREATE,
                    actions(ManualResolutionAction.RETRY_LOCAL, ManualResolutionAction.DISCARD_LOCAL),
                    "Si ya existe en server, descartá local o corregí los datos desde la pantalla principal."),
            policyEntry(SyncEntityType.GANADERO, SyncOperationType.STATUS_UPDATE,
                    actions(ManualResolutionAction.ACCEPT_SERVER, ManualResolutionAction.RETRY_LOCAL, ManualResolutionAction.DISCARD_LOCAL),
                    "El estado remoto manda: aceptá server o reintentá exactamente el mismo payload."),
            policyEntry(SyncEntityType.ANIMAL, SyncOperationType.CREATE,
                    actions(ManualResolutionAction.RETRY_LOCAL, ManualResolutionAction.DISCARD_LOCAL),
                    "La creación offline no admite accept_server en V2 porque necesita replay del alta original."),
            policyEntry(SyncEntityType.ANIMAL, SyncOperationType.UPDATE,
                    actions(ManualResolutionAction.ACCEPT_SERVER, ManualResolutionAction.RETRY_LOCAL, ManualResolutionAction.DISCARD_LOCAL),
                    "Compará el diff campo por campo antes de decidir si reintentás o aceptás server."),
            policyEntry(SyncEntityType.LOT, SyncOperationType.CREATE,
                    actions(ManualResolutionAction.RETRY_LOCAL, ManualResolutionAction.DISCARD_LOCAL),
                    "Los lotes se recrean reenviando el alta original o descartando la copia local."),
            policyEntry(SyncEntityType.LOT, SyncOperationType.UPDATE,
                    actions(ManualResolutionAction.ACCEPT_SERVER, ManualResolutionAction.RETRY_LOCAL, ManualResolutionAction.DISCARD_LOCAL),
                    "Para lotes manda el registro más nuevo; aceptá server o reintentá el patch local."),
            policyEntry(SyncEntityType.LOT_ASSIGNMENT, SyncOperationType.CREATE,
                    actions(ManualResolutionAction.RETRY_LOCAL, ManualResolutionAction.DISCARD_LOCAL),
                    "Las asignaciones temporales se validan por solapamiento; si chocan, corregí el rango antes de reintentar."),
            policyEntry(SyncEntityType.LOT_ASSIGNMENT, SyncOperationType.UPDATE,
                    actions(ManualResolutionAction.ACCEPT_SERVER, ManualResolutionAction.RETRY_LOCAL, ManualResolutionAction.DISCARD_LOCAL),
                    "La asignación canónica se decide por updatedAt y operationId; revisá el intervalo antes de reintentar."),
            policyEntry(SyncEntityType.PRODUCTIVITY_LEDGER, SyncOperationType.CREATE,
                    actions(ManualResolutionAction.ACCEPT_SERVER, ManualResolutionAction.RETRY_LOCAL, ManualResolutionAction.DISCARD_LOCAL),
                    "La productividad usa dedupe determinístico por identidad mensual; si el server ya ganó, aceptalo."),
            policyEntry(SyncEntityType.PRODUCTIVITY_LEDGER, SyncOperationType.UPDATE,
                    actions(ManualResolutionAction.ACCEPT_SERVER, ManualResolutionAction.RETRY_LOCAL, ManualResolutionAction.DISCARD_LOCAL),
                    "La entrada mensual se reemplaza sólo si el payload es más nuevo."),
            policyEntry(SyncEntityType.COST_LEDGER, SyncOperationType.CREATE,
                    actions(ManualResolutionAction.ACCEPT_SERVER, ManualResolutionAction.RETRY_LOCAL, ManualResolutionAction.DISCARD_LOCAL),
                    "Los costos se deduplican por periodo/lote/categoría/fuente con moneda fija V2."),
            policyEntry(SyncEntityType.COST_LEDGER, SyncOperationType.UPDATE,
                    actions(ManualResolutionAction.ACCEPT_SERVER, ManualResolutionAction.RETRY_LOCAL, ManualResolutionAction.DISCARD_LOCAL),
                    "La identidad de costo es estable; sólo persiste la versión más nueva del ledger."),
            policyEntry(SyncEntityType.ANIMAL_EVENT, SyncOperationType.CREATE,
                    actions(ManualResolutionAction.RETRY_LOCAL, ManualResolutionAction.DISCARD_LOCAL),
                    "Los eventos operativos se resuelven reintentando el payload original o descartándolo."),
            policyEntry(SyncEntityType.ANIMAL_HEALTH_EVENT, SyncOperationType.CREATE,
                    actions(ManualResolutionAction.RETRY_LOCAL, ManualResolutionAction.DISCARD_LOCAL),
                    "Los eventos sanitarios conservan idempotencia por operationId; no se edita payload en V2."),
            policyEntry(SyncEntityType.ANIMAL_REPRODUCTION_EVENT, SyncOperationType.CREATE,
                    actions(ManualResolutionAction.RETRY_LOCAL, ManualResolutionAction.DISCARD_LOCAL),
                    "Los eventos reproductivos requieren replay íntegro del payload offline original."),
            policyEntry(SyncEntityType.ANIMAL_IMAGE, SyncOperationType.CREATE,
                    actions(ManualResolutionAction.DISCARD_LOCAL),
                    "Las imágenes quedan excluidas de retry_local en V2 para evitar drift binario y re-subidas ambiguas."));

    private final AnimalEventMapper animalEventMapper;
    private final AnimalHealthEventMapper animalHealthEventMapper;
    private final AnimalReproductionEventMapper animalReproductionEventMapper;
    private final AnimalImageMapper animalImageMapper;

    public SyncPayloadMapper(
            AnimalEventMapper animalEventMapper,
            AnimalHealthEventMapper animalHealthEventMapper,
            AnimalReproductionEventMapper animalReproductionEventMapper,
            AnimalImageMapper animalImageMapper) {
        this.animalEventMapper = animalEventMapper;
        this.animalHealthEventMapper = animalHealthEventMapper;
        this.animalReproductionEventMapper = animalReproductionEventMapper;
        this.animalImageMapper = animalImageMapper;
    }

    public boolean isOfflineOperationAllowed(SyncEntityType entityType, SyncOperationType operationType) {
        return OFFLINE_CAPABILITY_MATRIX.getOrDefault(entityType, Set.of()).contains(operationType);
    }

    public ResolutionPolicyResponse resolveConflictPolicy(SyncEntityType entityType, SyncOperationType operationType) {
        return RESOLUTION_POLICY_MATRIX.get(new PolicyKey(entityType, operationType));
    }

    public String buildPolicyKey(SyncEntityType entityType, SyncOperationType operationType) {
        return "offline-conflict-resolution/" + POLICY_VERSION + "/" + entityType.name() + "/" + operationType.name();
    }

    public UUID parseUuid(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }

        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    /**
     * Temporary compatibility path for legacy offline clients still sending tag/code on ANIMAL UPDATE.
     * Canonical V1 clients must use ownerGanaderoId/arete/marca/tatuaje through {@link #toAnimalRequest(Map)}.
     */
    public void applyLegacyAnimalUpdatePayload(Animal animal, Map<String, Object> payload) {
        if (payload.containsKey("code") && payload.get("code") instanceof String code) {
            animal.setCode(code);
        }
        if (payload.containsKey("tag") && payload.get("tag") instanceof String tag) {
            animal.setTag(tag);
        }
        if (payload.containsKey("category") && payload.get("category") instanceof String category) {
            animal.setCategory(AnimalCategory.valueOf(category));
        }
        if (payload.containsKey("sex") && payload.get("sex") instanceof String sex) {
            animal.setSex(AnimalSex.valueOf(sex));
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

    public boolean hasAnimalCorePayload(Map<String, Object> payload) {
        return payload.containsKey("ownerGanaderoId")
                || payload.containsKey("arete")
                || payload.containsKey("marca")
                || payload.containsKey("tatuaje");
    }

    public AnimalRequest toAnimalRequest(Map<String, Object> payload) {
        UUID ownerGanaderoId = readOptionalUuid(payload.get("ownerGanaderoId"), "ANIMAL_OWNER_GANADERO_ID_INVALID");
        AnimalCategory category = readAnimalCategory(payload);
        AnimalSex sex = readAnimalSex(payload);
        Boolean active = readAnimalActive(payload);
        LocalDate admissionDate = readAnimalAdmissionDate(payload);

        return new AnimalRequest(
                ownerGanaderoId,
                readOptionalText(payload.get("arete")),
                readOptionalText(payload.get("marca")),
                readOptionalText(payload.get("tatuaje")),
                category,
                sex,
                active,
                admissionDate,
                readOptionalDecimal(payload.get("weightKg")),
                readOptionalDate(payload.get("birthDate"), "ANIMAL_BIRTH_DATE_INVALID"));
    }

    public UserStatus readUserStatus(Map<String, Object> payload) {
        Object rawStatus = payload.get("status");
        if (!(rawStatus instanceof String status) || status.isBlank()) {
            throw new IllegalArgumentException("USER_STATUS_REQUIRED");
        }

        try {
            return UserStatus.valueOf(status);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("USER_STATUS_INVALID");
        }
    }

    public GanaderoCreateRequest toGanaderoCreateRequest(Map<String, Object> payload) {
        Object rawBusinessIdentifier = payload.get("businessIdentifier");
        Object rawName = payload.get("name");

        if (!(rawBusinessIdentifier instanceof String businessIdentifier) || businessIdentifier.isBlank()) {
            throw new IllegalArgumentException("GANADERO_BUSINESS_IDENTIFIER_REQUIRED");
        }
        if (!(rawName instanceof String name) || name.isBlank()) {
            throw new IllegalArgumentException("GANADERO_NAME_REQUIRED");
        }

        return new GanaderoCreateRequest(businessIdentifier, name, null);
    }

    public Boolean readGanaderoActive(Map<String, Object> payload) {
        Object rawActive = payload.get("active");
        if (!(rawActive instanceof Boolean active)) {
            throw new IllegalArgumentException("GANADERO_ACTIVE_REQUIRED");
        }

        return active;
    }

    public AnimalEventRequest toAnimalEventRequest(Map<String, Object> payload, java.time.OffsetDateTime clientCreatedAt) {
        return animalEventMapper.toRequest(payload, clientCreatedAt);
    }

    public AnimalHealthEventRequest toAnimalHealthEventRequest(Map<String, Object> payload, java.time.OffsetDateTime clientCreatedAt) {
        return animalHealthEventMapper.toRequest(payload, clientCreatedAt);
    }

    public AnimalReproductionEventRequest toAnimalReproductionEventRequest(
            Map<String, Object> payload,
            java.time.OffsetDateTime clientCreatedAt) {
        return animalReproductionEventMapper.toRequest(payload, clientCreatedAt);
    }

    public AnimalImageRequest toAnimalImageRequest(Map<String, Object> payload, java.time.OffsetDateTime clientCreatedAt) {
        return animalImageMapper.toRequest(payload, clientCreatedAt);
    }

    public HerdLotPayload toHerdLotPayload(Map<String, Object> payload) {
        String name = requireText(payload.get("name"), "LOT_NAME_REQUIRED");
        Boolean active = readRequiredBoolean(payload.get("active"), "LOT_ACTIVE_REQUIRED");
        return new HerdLotPayload(name, readOptionalText(payload.get("description")), active);
    }

    public HerdLotAssignmentPayload toHerdLotAssignmentPayload(Map<String, Object> payload) {
        UUID animalUuid = requireUuid(payload.get("animalUuid"), "LOT_ASSIGNMENT_ANIMAL_REQUIRED");
        UUID lotId = requireUuid(payload.get("lotId"), "LOT_ASSIGNMENT_LOT_REQUIRED");
        LocalDate fromDate = requireDate(payload.get("fromDate"), "LOT_ASSIGNMENT_FROM_DATE_REQUIRED", "LOT_ASSIGNMENT_FROM_DATE_INVALID");
        LocalDate toDate = readOptionalDate(payload.get("toDate"), "LOT_ASSIGNMENT_TO_DATE_INVALID");
        if (toDate != null && toDate.isBefore(fromDate)) {
            throw new IllegalArgumentException("LOT_ASSIGNMENT_RANGE_INVALID");
        }
        return new HerdLotAssignmentPayload(animalUuid, lotId, fromDate, toDate);
    }

    public HerdProductivityLedgerPayload toHerdProductivityLedgerPayload(Map<String, Object> payload) {
        // V2 contract decision: periodKey is monthly-only (YYYY-MM) and identities are installation-local.
        UUID animalUuid = requireUuid(payload.get("animalUuid"), "PRODUCTIVITY_LEDGER_ANIMAL_REQUIRED");
        UUID lotId = requireUuid(payload.get("lotId"), "PRODUCTIVITY_LEDGER_LOT_REQUIRED");
        String periodKey = requirePeriodKey(payload.get("periodKey"), "PRODUCTIVITY_LEDGER_PERIOD_KEY_REQUIRED", "PRODUCTIVITY_LEDGER_PERIOD_KEY_INVALID");
        String metricType = requireText(payload.get("metricType"), "PRODUCTIVITY_LEDGER_METRIC_TYPE_REQUIRED");
        BigDecimal value = requireNonNegativeDecimal(payload.get("value"), "PRODUCTIVITY_LEDGER_VALUE_REQUIRED", "PRODUCTIVITY_LEDGER_VALUE_INVALID");
        return new HerdProductivityLedgerPayload(animalUuid, lotId, periodKey, metricType, value,
                buildProductivityIdentity(periodKey, animalUuid, lotId, metricType));
    }

    public HerdCostLedgerPayload toHerdCostLedgerPayload(Map<String, Object> payload) {
        // V2 contract decision: currency is fixed per installation, so payloads must be self-contained without conversion.
        UUID lotId = requireUuid(payload.get("lotId"), "COST_LEDGER_LOT_REQUIRED");
        String periodKey = requirePeriodKey(payload.get("periodKey"), "COST_LEDGER_PERIOD_KEY_REQUIRED", "COST_LEDGER_PERIOD_KEY_INVALID");
        String category = requireText(payload.get("category"), "COST_LEDGER_CATEGORY_REQUIRED");
        String source = requireText(payload.get("source"), "COST_LEDGER_SOURCE_REQUIRED");
        BigDecimal amount = requireNonNegativeDecimal(payload.get("amount"), "COST_LEDGER_AMOUNT_REQUIRED", "COST_LEDGER_AMOUNT_INVALID");
        String currency = requireText(payload.get("currency"), "COST_LEDGER_CURRENCY_REQUIRED");
        return new HerdCostLedgerPayload(lotId, periodKey, category, source, amount, currency,
                buildCostIdentity(periodKey, lotId, category, source));
    }

    public String buildProductivityIdentity(String periodKey, UUID animalUuid, UUID lotId, String metricType) {
        return periodKey + "|" + animalUuid + "|" + lotId + "|" + metricType.trim().toUpperCase();
    }

    public String buildCostIdentity(String periodKey, UUID lotId, String category, String source) {
        return periodKey + "|" + lotId + "|" + category.trim().toUpperCase() + "|" + source.trim().toUpperCase();
    }

    private UUID requireUuid(Object rawValue, String errorCode) {
        if (!(rawValue instanceof String value) || value.isBlank()) {
            throw new IllegalArgumentException(errorCode);
        }

        UUID uuid = parseUuid(value);
        if (uuid == null) {
            throw new IllegalArgumentException(errorCode);
        }

        return uuid;
    }

    private UUID readOptionalUuid(Object rawValue, String invalidCode) {
        if (rawValue == null) {
            return null;
        }
        if (!(rawValue instanceof String value) || value.isBlank()) {
            throw new IllegalArgumentException(invalidCode);
        }

        UUID uuid = parseUuid(value);
        if (uuid == null) {
            throw new IllegalArgumentException(invalidCode);
        }

        return uuid;
    }

    private String requirePeriodKey(Object rawValue, String requiredCode, String invalidCode) {
        String value = requireText(rawValue, requiredCode);
        try {
            YearMonth.parse(value);
            return value;
        } catch (Exception exception) {
            throw new IllegalArgumentException(invalidCode);
        }
    }

    private BigDecimal requireNonNegativeDecimal(Object rawValue, String requiredCode, String invalidCode) {
        if (rawValue == null) {
            throw new IllegalArgumentException(requiredCode);
        }

        try {
            BigDecimal value = new BigDecimal(String.valueOf(rawValue));
            if (value.signum() < 0) {
                throw new IllegalArgumentException(invalidCode);
            }
            return value;
        } catch (NumberFormatException exception) {
            throw new IllegalArgumentException(invalidCode);
        }
    }

    private String requireText(Object rawValue, String errorCode) {
        if (!(rawValue instanceof String value) || value.isBlank()) {
            throw new IllegalArgumentException(errorCode);
        }
        return value.trim();
    }

    private Boolean readRequiredBoolean(Object rawValue, String errorCode) {
        if (!(rawValue instanceof Boolean value)) {
            throw new IllegalArgumentException(errorCode);
        }
        return value;
    }

    private LocalDate requireDate(Object rawValue, String requiredCode, String invalidCode) {
        if (!(rawValue instanceof String value) || value.isBlank()) {
            throw new IllegalArgumentException(requiredCode);
        }
        try {
            return LocalDate.parse(value);
        } catch (Exception exception) {
            throw new IllegalArgumentException(invalidCode);
        }
    }

    private LocalDate readOptionalDate(Object rawValue, String invalidCode) {
        if (rawValue == null) {
            return null;
        }
        if (!(rawValue instanceof String value) || value.isBlank()) {
            throw new IllegalArgumentException(invalidCode);
        }
        try {
            return LocalDate.parse(value);
        } catch (Exception exception) {
            throw new IllegalArgumentException(invalidCode);
        }
    }

    private AnimalCategory readAnimalCategory(Map<String, Object> payload) {
        Object rawCategory = payload.get("category");
        if (!(rawCategory instanceof String category) || category.isBlank()) {
            throw new IllegalArgumentException("ANIMAL_CATEGORY_REQUIRED");
        }

        try {
            return switch (category.trim().toUpperCase()) {
                case "COW" -> AnimalCategory.VACA;
                case "BULL" -> AnimalCategory.TORO;
                case "HEIFER" -> AnimalCategory.VAQUILLONA;
                case "CALF" -> readAnimalSex(payload) == AnimalSex.HEMBRA ? AnimalCategory.TERNERA : AnimalCategory.TERNERO;
                default -> AnimalCategory.valueOf(category.trim().toUpperCase());
            };
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("ANIMAL_CATEGORY_INVALID");
        }
    }

    private AnimalSex readAnimalSex(Map<String, Object> payload) {
        Object rawSex = payload.get("sex");
        if (!(rawSex instanceof String sex) || sex.isBlank()) {
            return inferLegacyAnimalSex(payload);
        }

        try {
            return AnimalSex.valueOf(sex);
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("ANIMAL_SEX_INVALID");
        }
    }

    private AnimalSex inferLegacyAnimalSex(Map<String, Object> payload) {
        Object rawCategory = payload.get("category");
        if (!(rawCategory instanceof String category) || category.isBlank()) {
            throw new IllegalArgumentException("ANIMAL_SEX_REQUIRED");
        }

        return switch (category.trim().toUpperCase()) {
            case "COW", "HEIFER", "VACA", "VAQUILLONA", "TERNERA" -> AnimalSex.HEMBRA;
            case "BULL", "TORO", "BUEY", "TERNERO", "CALF" -> AnimalSex.MACHO;
            default -> throw new IllegalArgumentException("ANIMAL_SEX_REQUIRED");
        };
    }

    private Boolean readAnimalActive(Map<String, Object> payload) {
        Object rawActive = payload.get("active");
        if (!(rawActive instanceof Boolean active)) {
            throw new IllegalArgumentException("ANIMAL_ACTIVE_REQUIRED");
        }

        return active;
    }

    private LocalDate readAnimalAdmissionDate(Map<String, Object> payload) {
        Object rawAdmissionDate = payload.get("admissionDate");
        if (!(rawAdmissionDate instanceof String admissionDate) || admissionDate.isBlank()) {
            throw new IllegalArgumentException("ANIMAL_ADMISSION_DATE_REQUIRED");
        }

        try {
            return LocalDate.parse(admissionDate);
        } catch (Exception exception) {
            throw new IllegalArgumentException("ANIMAL_ADMISSION_DATE_INVALID");
        }
    }

    private BigDecimal readOptionalDecimal(Object rawValue) {
        if (rawValue == null) {
            return null;
        }

        return new BigDecimal(String.valueOf(rawValue));
    }

    private String readOptionalText(Object rawValue) {
        if (rawValue == null) {
            return null;
        }
        if (!(rawValue instanceof String value)) {
            throw new IllegalArgumentException("ANIMAL_VISIBLE_IDENTIFIER_INVALID");
        }

        String normalized = value.trim();
        return normalized.isEmpty() ? null : normalized;
    }

    private static Map.Entry<PolicyKey, ResolutionPolicyResponse> policyEntry(
            SyncEntityType entityType,
            SyncOperationType operationType,
            java.util.List<String> allowedActions,
            String uxHint) {
        return Map.entry(
                new PolicyKey(entityType, operationType),
                new ResolutionPolicyResponse(
                        entityType,
                        operationType,
                        allowedActions,
                        uxHint,
                        "offline-conflict-resolution/" + POLICY_VERSION + "/" + entityType.name() + "/" + operationType.name(),
                        POLICY_VERSION));
    }

    private static java.util.List<String> actions(ManualResolutionAction... values) {
        return java.util.Arrays.stream(values).map(ManualResolutionAction::apiValue).toList();
    }

    private record PolicyKey(SyncEntityType entityType, SyncOperationType operationType) {
    }

    public record HerdLotPayload(String name, String description, boolean active) {
    }

    public record HerdLotAssignmentPayload(UUID animalUuid, UUID lotId, LocalDate fromDate, LocalDate toDate) {
    }

    public record HerdProductivityLedgerPayload(
            UUID animalUuid,
            UUID lotId,
            String periodKey,
            String metricType,
            BigDecimal value,
            String identityKey) {
    }

    public record HerdCostLedgerPayload(
            UUID lotId,
            String periodKey,
            String category,
            String source,
            BigDecimal amount,
            String currency,
            String identityKey) {
    }
}

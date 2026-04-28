package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.OperationLog;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.OperationLogRepository;
import bo.pasorapa.hato.service.dto.admin.common.MutationResult;
import bo.pasorapa.hato.service.dto.admin.ganadero.GanaderoCreateRequest;
import bo.pasorapa.hato.service.dto.admin.ganadero.GanaderoResponse;
import bo.pasorapa.hato.service.dto.admin.ganadero.GanaderoStatusUpdateRequest;
import bo.pasorapa.hato.service.dto.admin.ganadero.GanaderosListResponse;
import bo.pasorapa.hato.service.error.BusinessException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.transaction.Transactional;
import jakarta.ws.rs.core.Response;
import java.time.LocalDateTime;
import java.util.UUID;

@ApplicationScoped
public class GanaderoService {

    private final GanaderoRepository ganaderoRepository;
    private final OperationLogRepository operationLogRepository;

    public GanaderoService(GanaderoRepository ganaderoRepository, OperationLogRepository operationLogRepository) {
        this.ganaderoRepository = ganaderoRepository;
        this.operationLogRepository = operationLogRepository;
    }

    public GanaderosListResponse list(Boolean active) {
        return new GanaderosListResponse(ganaderoRepository.listByActive(active).stream().map(this::toResponse).toList());
    }

    @Transactional
    public MutationResult<GanaderoResponse> create(GanaderoCreateRequest request, UUID operationId, UUID performedByUserId) {
        MutationResult<Ganadero> mutation = createGanadero(null, request, operationId, performedByUserId, "GANADERO_CREATED", false);
        return new MutationResult<>(toResponse(mutation.data()), mutation.replayed());
    }

    @Transactional
    public MutationResult<Ganadero> syncCreate(UUID stableGanaderoId, GanaderoCreateRequest request, UUID operationId, UUID performedByUserId) {
        return createGanadero(stableGanaderoId, request, operationId, performedByUserId, "SYNC_GANADERO_CREATED", true);
    }

    @Transactional
    public MutationResult<GanaderoResponse> updateStatus(UUID ganaderoId, GanaderoStatusUpdateRequest request, UUID operationId, UUID performedByUserId) {
        MutationResult<Ganadero> mutation = updateGanaderoStatus(ganaderoId, request.active(), operationId, performedByUserId, "GANADERO_STATUS_UPDATED", false);
        return new MutationResult<>(toResponse(mutation.data()), mutation.replayed());
    }

    @Transactional
    public MutationResult<Ganadero> syncUpdateStatus(UUID ganaderoId, boolean active, UUID operationId, UUID performedByUserId) {
        return updateGanaderoStatus(ganaderoId, active, operationId, performedByUserId, "SYNC_GANADERO_STATUS_UPDATED", true);
    }

    private MutationResult<Ganadero> createGanadero(
            UUID stableGanaderoId,
            GanaderoCreateRequest request,
            UUID operationId,
            UUID performedByUserId,
            String action,
            boolean synced) {
        OperationLog existingOperation = operationLogRepository.findByOperationId(operationId).orElse(null);
        if (existingOperation != null && existingOperation.getResourceId() != null) {
            return new MutationResult<>(findGanadero(existingOperation.getResourceId()), true);
        }

        if (ganaderoRepository.findByBusinessIdentifier(request.businessIdentifier().trim()).isPresent()) {
            throw new BusinessException("GANADERO_ALREADY_EXISTS", "Ya existe un ganadero con ese identificador.", Response.Status.CONFLICT);
        }

        Ganadero ganadero = new Ganadero();
        if (stableGanaderoId != null) {
            ganadero.setId(stableGanaderoId);
        }
        ganadero.setBusinessIdentifier(request.businessIdentifier().trim());
        ganadero.setName(request.name().trim());
        ganadero.setActive(true);
        if (synced) {
            ganadero.setLastSyncedAt(LocalDateTime.now());
        }
        ganaderoRepository.persist(ganadero);
        ganaderoRepository.flush();

        persistOperation(operationId, action, ganadero.getId(), performedByUserId);
        return new MutationResult<>(ganadero, false);
    }

    private MutationResult<Ganadero> updateGanaderoStatus(
            UUID ganaderoId,
            boolean active,
            UUID operationId,
            UUID performedByUserId,
            String action,
            boolean synced) {
        OperationLog existingOperation = operationLogRepository.findByOperationId(operationId).orElse(null);
        if (existingOperation != null && existingOperation.getResourceId() != null) {
            return new MutationResult<>(findGanadero(existingOperation.getResourceId()), true);
        }

        Ganadero ganadero = findGanadero(ganaderoId);
        ganadero.setActive(active);
        if (synced) {
            ganadero.setLastSyncedAt(LocalDateTime.now());
        }
        ganaderoRepository.persist(ganadero);
        ganaderoRepository.flush();

        persistOperation(operationId, action, ganadero.getId(), performedByUserId);
        return new MutationResult<>(ganadero, false);
    }

    private Ganadero findGanadero(UUID ganaderoId) {
        return ganaderoRepository.findByIdOptional(ganaderoId)
                .orElseThrow(() -> new BusinessException("GANADERO_NOT_FOUND", "No encontramos el ganadero solicitado.", Response.Status.NOT_FOUND));
    }

    private void persistOperation(UUID operationId, String action, UUID resourceId, UUID performedByUserId) {
        OperationLog operationLog = new OperationLog();
        operationLog.setOperationId(operationId);
        operationLog.setAction(action);
        operationLog.setResourceType("GANADERO");
        operationLog.setResourceId(resourceId);
        operationLog.setPerformedByUserId(performedByUserId);
        operationLogRepository.persist(operationLog);
    }

    private GanaderoResponse toResponse(Ganadero ganadero) {
        return new GanaderoResponse(
                ganadero.getId().toString(),
                ganadero.getBusinessIdentifier(),
                ganadero.getName(),
                ganadero.isActive(),
                ganadero.getVersion() == null ? 0L : ganadero.getVersion(),
                ganadero.getCreatedAt() == null ? null : ganadero.getCreatedAt().toString(),
                ganadero.getUpdatedAt() == null ? null : ganadero.getUpdatedAt().toString(),
                ganadero.getLastSyncedAt() == null ? null : ganadero.getLastSyncedAt().toString());
    }
}

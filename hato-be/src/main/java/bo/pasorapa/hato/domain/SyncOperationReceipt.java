package bo.pasorapa.hato.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "sync_operation_receipts")
public class SyncOperationReceipt {

    @Id
    @Column(name = "operation_id", nullable = false, updatable = false)
    private UUID operationId;

    @Column(name = "entity_type", nullable = false, length = 40)
    private String entityType;

    @Column(name = "entity_id", nullable = false, length = 80)
    private String entityId;

    @Column(name = "classification", nullable = false, length = 40)
    private String classification;

    @Column(name = "server_version")
    private Integer serverVersion;

    @Column(name = "client_version")
    private Integer clientVersion;

    @Column(name = "reason", length = 255)
    private String reason;

    @Column(name = "resolution_hint", length = 80)
    private String resolutionHint;

    @Column(name = "server_state_json", columnDefinition = "TEXT")
    private String serverStateJson;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }

    public UUID getOperationId() {
        return operationId;
    }

    public void setOperationId(UUID operationId) {
        this.operationId = operationId;
    }

    public String getEntityType() {
        return entityType;
    }

    public void setEntityType(String entityType) {
        this.entityType = entityType;
    }

    public String getEntityId() {
        return entityId;
    }

    public void setEntityId(String entityId) {
        this.entityId = entityId;
    }

    public String getClassification() {
        return classification;
    }

    public void setClassification(String classification) {
        this.classification = classification;
    }

    public Integer getServerVersion() {
        return serverVersion;
    }

    public void setServerVersion(Integer serverVersion) {
        this.serverVersion = serverVersion;
    }

    public Integer getClientVersion() {
        return clientVersion;
    }

    public void setClientVersion(Integer clientVersion) {
        this.clientVersion = clientVersion;
    }

    public String getReason() {
        return reason;
    }

    public void setReason(String reason) {
        this.reason = reason;
    }

    public String getResolutionHint() {
        return resolutionHint;
    }

    public void setResolutionHint(String resolutionHint) {
        this.resolutionHint = resolutionHint;
    }

    public String getServerStateJson() {
        return serverStateJson;
    }

    public void setServerStateJson(String serverStateJson) {
        this.serverStateJson = serverStateJson;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }
}

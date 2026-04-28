package bo.pasorapa.hato.domain;

import bo.pasorapa.hato.domain.enumeration.AdminNotificationTargetingMode;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "admin_notifications")
public class AdminNotification {

    @Id
    @Column(nullable = false, updatable = false)
    private UUID id;

    @Column(nullable = false, length = 160)
    private String title;

    @Column(nullable = false, length = 2000)
    private String body;

    @Enumerated(EnumType.STRING)
    @Column(name = "targeting_mode", nullable = false, length = 40)
    private AdminNotificationTargetingMode targetingMode;

    @Column(name = "include_user_ids_json", length = 4000)
    private String includeUserIdsJson;

    @Column(name = "exclude_user_ids_json", length = 4000)
    private String excludeUserIdsJson;

    @Column(name = "recipient_count", nullable = false)
    private Integer recipientCount;

    @Column(name = "created_by_user_id", nullable = false)
    private UUID createdByUserId;

    @Column(name = "published_at", nullable = false)
    private LocalDateTime publishedAt;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (id == null) {
            id = UUID.randomUUID();
        }
        if (publishedAt == null) {
            publishedAt = now;
        }
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = createdAt;
        }
        if (recipientCount == null) {
            recipientCount = 0;
        }
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public AdminNotificationTargetingMode getTargetingMode() { return targetingMode; }
    public void setTargetingMode(AdminNotificationTargetingMode targetingMode) { this.targetingMode = targetingMode; }
    public String getIncludeUserIdsJson() { return includeUserIdsJson; }
    public void setIncludeUserIdsJson(String includeUserIdsJson) { this.includeUserIdsJson = includeUserIdsJson; }
    public String getExcludeUserIdsJson() { return excludeUserIdsJson; }
    public void setExcludeUserIdsJson(String excludeUserIdsJson) { this.excludeUserIdsJson = excludeUserIdsJson; }
    public Integer getRecipientCount() { return recipientCount; }
    public void setRecipientCount(Integer recipientCount) { this.recipientCount = recipientCount; }
    public UUID getCreatedByUserId() { return createdByUserId; }
    public void setCreatedByUserId(UUID createdByUserId) { this.createdByUserId = createdByUserId; }
    public LocalDateTime getPublishedAt() { return publishedAt; }
    public void setPublishedAt(LocalDateTime publishedAt) { this.publishedAt = publishedAt; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}

package bo.pasorapa.hato.service.model;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.enumeration.AnimalReproductionEventType;
import java.time.LocalDateTime;
import java.util.UUID;

public class AnimalReproductionEvent {

    private UUID eventId;
    private Animal animal;
    private AnimalReproductionEventType reproductionEventType;
    private LocalDateTime occurredAt;
    private LocalDateTime clientCreatedAt;
    private String notes;
    private UUID performedByUserId;
    private String sourceChannel;
    private UUID operationId;
    private String metadataJson;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    public UUID getEventId() { return eventId; }
    public void setEventId(UUID eventId) { this.eventId = eventId; }
    public Animal getAnimal() { return animal; }
    public void setAnimal(Animal animal) { this.animal = animal; }
    public AnimalReproductionEventType getReproductionEventType() { return reproductionEventType; }
    public void setReproductionEventType(AnimalReproductionEventType reproductionEventType) { this.reproductionEventType = reproductionEventType; }
    public LocalDateTime getOccurredAt() { return occurredAt; }
    public void setOccurredAt(LocalDateTime occurredAt) { this.occurredAt = occurredAt; }
    public LocalDateTime getClientCreatedAt() { return clientCreatedAt; }
    public void setClientCreatedAt(LocalDateTime clientCreatedAt) { this.clientCreatedAt = clientCreatedAt; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public UUID getPerformedByUserId() { return performedByUserId; }
    public void setPerformedByUserId(UUID performedByUserId) { this.performedByUserId = performedByUserId; }
    public String getSourceChannel() { return sourceChannel; }
    public void setSourceChannel(String sourceChannel) { this.sourceChannel = sourceChannel; }
    public UUID getOperationId() { return operationId; }
    public void setOperationId(UUID operationId) { this.operationId = operationId; }
    public String getMetadataJson() { return metadataJson; }
    public void setMetadataJson(String metadataJson) { this.metadataJson = metadataJson; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}

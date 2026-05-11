package bo.pasorapa.hato.domain;

import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;
import jakarta.persistence.Version;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;

@Entity
@Table(name = "animals")
public class Animal {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "uuid", nullable = false, unique = true, updatable = false)
    private UUID uuid;

    @Column(name = "code", nullable = false, unique = true, length = 50)
    private String code;

    @Column(name = "tag", nullable = false, unique = true, length = 50)
    private String tag;

    @ManyToOne(optional = false)
    @JoinColumn(name = "owner_ganadero_id", nullable = false)
    private Ganadero ownerGanadero;

    @Column(name = "arete", length = 80)
    private String arete;

    @Column(name = "marca", length = 80)
    private String marca;

    @Column(name = "tatuaje", length = 80)
    private String tatuaje;

    @Column(name = "arete_normalized", length = 80, unique = true)
    private String areteNormalized;

    @Column(name = "marca_normalized", length = 80)
    private String marcaNormalized;

    @Column(name = "tatuaje_normalized", length = 80)
    private String tatuajeNormalized;

    @Enumerated(EnumType.STRING)
    @Column(name = "category", nullable = false, length = 30)
    private AnimalCategory category;

    @Enumerated(EnumType.STRING)
    @Column(name = "sex", length = 10)
    private AnimalSex sex;

    @Column(name = "active", nullable = false)
    private Boolean active = Boolean.TRUE;

    @Column(name = "admission_date", nullable = false)
    private LocalDate admissionDate;

    @Column(name = "weight_kg", precision = 10, scale = 2)
    private BigDecimal weightKg;

    @Column(name = "color", length = 120)
    private String color;

    @Column(name = "description", length = 500)
    private String description;

    @ManyToOne
    @JoinColumn(name = "breed_id")
    private Raza breed;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Version
    @Column(name = "version", nullable = false)
    private Long version;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @Column(name = "last_synced_at")
    private LocalDateTime lastSyncedAt;

    @Column(name = "mother_animal_uuid")
    private UUID motherAnimalUuid;

    @Column(name = "father_animal_uuid")
    private UUID fatherAnimalUuid;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @PrePersist
    void prePersist() {
        LocalDateTime now = LocalDateTime.now();
        if (uuid == null) {
            uuid = UUID.randomUUID();
        }
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
        if (version == null) {
            version = 0L;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public UUID getUuid() {
        return uuid;
    }

    public void setUuid(UUID uuid) {
        this.uuid = uuid;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getTag() {
        return tag;
    }

    public void setTag(String tag) {
        this.tag = tag;
    }

    public Ganadero getOwnerGanadero() {
        return ownerGanadero;
    }

    public void setOwnerGanadero(Ganadero ownerGanadero) {
        this.ownerGanadero = ownerGanadero;
    }

    public String getArete() {
        return arete;
    }

    public void setArete(String arete) {
        this.arete = arete;
    }

    public String getMarca() {
        return marca;
    }

    public void setMarca(String marca) {
        this.marca = marca;
    }

    public String getTatuaje() {
        return tatuaje;
    }

    public void setTatuaje(String tatuaje) {
        this.tatuaje = tatuaje;
    }

    public String getAreteNormalized() {
        return areteNormalized;
    }

    public void setAreteNormalized(String areteNormalized) {
        this.areteNormalized = areteNormalized;
    }

    public String getMarcaNormalized() {
        return marcaNormalized;
    }

    public void setMarcaNormalized(String marcaNormalized) {
        this.marcaNormalized = marcaNormalized;
    }

    public String getTatuajeNormalized() {
        return tatuajeNormalized;
    }

    public void setTatuajeNormalized(String tatuajeNormalized) {
        this.tatuajeNormalized = tatuajeNormalized;
    }

    public AnimalCategory getCategory() {
        return category;
    }

    public void setCategory(AnimalCategory category) {
        this.category = category;
    }

    public AnimalSex getSex() {
        return sex;
    }

    public void setSex(AnimalSex sex) {
        this.sex = sex;
    }

    public Boolean getActive() {
        return active;
    }

    public void setActive(Boolean active) {
        this.active = active;
    }

    public LocalDate getAdmissionDate() {
        return admissionDate;
    }

    public void setAdmissionDate(LocalDate admissionDate) {
        this.admissionDate = admissionDate;
    }

    public BigDecimal getWeightKg() {
        return weightKg;
    }

    public void setWeightKg(BigDecimal weightKg) {
        this.weightKg = weightKg;
    }

    public String getColor() {
        return color;
    }

    public void setColor(String color) {
        this.color = color;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Raza getBreed() {
        return breed;
    }

    public void setBreed(Raza breed) {
        this.breed = breed;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public Long getVersion() {
        return version;
    }

    public void setVersion(Long version) {
        this.version = version;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public LocalDateTime getLastSyncedAt() {
        return lastSyncedAt;
    }

    public void setLastSyncedAt(LocalDateTime lastSyncedAt) {
        this.lastSyncedAt = lastSyncedAt;
    }

    public UUID getMotherAnimalUuid() {
        return motherAnimalUuid;
    }

    public void setMotherAnimalUuid(UUID motherAnimalUuid) {
        this.motherAnimalUuid = motherAnimalUuid;
    }

    public UUID getFatherAnimalUuid() {
        return fatherAnimalUuid;
    }

    public void setFatherAnimalUuid(UUID fatherAnimalUuid) {
        this.fatherAnimalUuid = fatherAnimalUuid;
    }

    public LocalDate getBirthDate() {
        return birthDate;
    }

    public void setBirthDate(LocalDate birthDate) {
        this.birthDate = birthDate;
    }
}

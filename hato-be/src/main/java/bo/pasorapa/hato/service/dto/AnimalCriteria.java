package bo.pasorapa.hato.service.dto;

import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.service.filter.filters.BooleanFilter;
import bo.pasorapa.hato.service.filter.filters.EnumFilter;
import bo.pasorapa.hato.service.filter.filters.LocalDateFilter;
import bo.pasorapa.hato.service.filter.filters.LongFilter;
import bo.pasorapa.hato.service.filter.filters.StringFilter;
import bo.pasorapa.hato.service.filter.filters.UuidFilter;
import io.quarkus.runtime.annotations.RegisterForReflection;

@RegisterForReflection
public class AnimalCriteria {

    private LongFilter id;
    private StringFilter visible;
    private UuidFilter ownerGanaderoId;
    private EnumFilter<AnimalCategory> category;
    private BooleanFilter active;
    private LocalDateFilter admissionDate;

    public LongFilter getId() {
        return id;
    }

    public void setId(LongFilter id) {
        this.id = id;
    }

    public StringFilter getVisible() {
        return visible;
    }

    public void setVisible(StringFilter visible) {
        this.visible = visible;
    }

    public UuidFilter getOwnerGanaderoId() {
        return ownerGanaderoId;
    }

    public void setOwnerGanaderoId(UuidFilter ownerGanaderoId) {
        this.ownerGanaderoId = ownerGanaderoId;
    }

    public EnumFilter<AnimalCategory> getCategory() {
        return category;
    }

    public void setCategory(EnumFilter<AnimalCategory> category) {
        this.category = category;
    }

    public BooleanFilter getActive() {
        return active;
    }

    public void setActive(BooleanFilter active) {
        this.active = active;
    }

    public LocalDateFilter getAdmissionDate() {
        return admissionDate;
    }

    public void setAdmissionDate(LocalDateFilter admissionDate) {
        this.admissionDate = admissionDate;
    }
}

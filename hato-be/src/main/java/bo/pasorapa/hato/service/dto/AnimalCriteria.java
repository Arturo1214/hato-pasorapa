package bo.pasorapa.hato.service.dto;

import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.service.filter.filters.BooleanFilter;
import bo.pasorapa.hato.service.filter.filters.EnumFilter;
import bo.pasorapa.hato.service.filter.filters.LocalDateFilter;
import bo.pasorapa.hato.service.filter.filters.LongFilter;
import bo.pasorapa.hato.service.filter.filters.StringFilter;

public class AnimalCriteria {

    private LongFilter id;
    private StringFilter code;
    private StringFilter tag;
    private EnumFilter<AnimalCategory> category;
    private BooleanFilter active;
    private LocalDateFilter admissionDate;

    public LongFilter getId() {
        return id;
    }

    public void setId(LongFilter id) {
        this.id = id;
    }

    public StringFilter getCode() {
        return code;
    }

    public void setCode(StringFilter code) {
        this.code = code;
    }

    public StringFilter getTag() {
        return tag;
    }

    public void setTag(StringFilter tag) {
        this.tag = tag;
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


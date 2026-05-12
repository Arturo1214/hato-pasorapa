package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.AnimalHealthEvent;
import bo.pasorapa.hato.repository.AnimalHealthEventRepository;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;

@ApplicationScoped
public class AnimalHealthEventCompatibilityView {

    private final AnimalHealthEventRepository animalHealthEventRepository;

    public AnimalHealthEventCompatibilityView(AnimalHealthEventRepository animalHealthEventRepository) {
        this.animalHealthEventRepository = animalHealthEventRepository;
    }

    public List<AnimalHealthEvent> findByVisitId(String visitId) {
        return animalHealthEventRepository.findByVisitId(visitId);
    }

    public List<AnimalHealthEvent> findByParentVisitId(String parentVisitId) {
        return animalHealthEventRepository.findByParentVisitId(parentVisitId);
    }
}

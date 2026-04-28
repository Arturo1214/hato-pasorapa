package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.service.dto.AnimalCriteria;
import bo.pasorapa.hato.service.filter.QueryUtil;
import bo.pasorapa.hato.service.page.Page;
import bo.pasorapa.hato.service.page.PageRequest;
import bo.pasorapa.hato.service.page.PageUtil;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Path;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class AnimalQueryService {

    private final AnimalRepository animalRepository;

    public AnimalQueryService(AnimalRepository animalRepository) {
        this.animalRepository = animalRepository;
    }

    public Optional<Animal> findOne(UUID uuid) {
        return animalRepository.findByUuid(uuid);
    }

    public long countByCriteria(AnimalCriteria criteria) {
        CriteriaBuilder cb = animalRepository.getEntityManager().getCriteriaBuilder();
        CriteriaQuery<Long> countQuery = cb.createQuery(Long.class);
        Root<Animal> root = countQuery.from(Animal.class);
        List<Predicate> predicates = buildPredicates(criteria, cb, root);

        countQuery.select(cb.count(root));
        if (!predicates.isEmpty()) {
            countQuery.where(QueryUtil.combinePredicatesAnd(cb, predicates));
        }

        return animalRepository.getEntityManager().createQuery(countQuery).getSingleResult();
    }

    public Page<Animal> findByCriteriaPaged(AnimalCriteria criteria, PageRequest pageRequest) {
        CriteriaBuilder cb = animalRepository.getEntityManager().getCriteriaBuilder();
        CriteriaQuery<Animal> query = cb.createQuery(Animal.class);
        Root<Animal> root = query.from(Animal.class);
        List<Predicate> predicates = buildPredicates(criteria, cb, root);

        query.select(root);
        if (!predicates.isEmpty()) {
            query.where(QueryUtil.combinePredicatesAnd(cb, predicates));
        }

        return PageUtil.getPage(
                animalRepository.getEntityManager(),
                query,
                pageRequest,
                (builder, countRoot) -> buildPredicates(criteria, builder, countRoot)
        );
    }

    private List<Predicate> buildPredicates(AnimalCriteria criteria, CriteriaBuilder cb, Root<Animal> root) {
        List<Predicate> predicates = new ArrayList<>();
        if (criteria == null) {
            return predicates;
        }

        QueryUtil.addPredicateRange(predicates, cb, root, "id", criteria.getId());
        addVisiblePredicate(predicates, cb, root, criteria);
        QueryUtil.addPredicate(predicates, cb, root.get("ownerGanadero").get("id"), criteria.getOwnerGanaderoId());
        QueryUtil.addPredicateEnum(predicates, cb, root, "category", criteria.getCategory());
        QueryUtil.addPredicate(predicates, cb, root, "active", criteria.getActive());
        QueryUtil.addPredicateRange(predicates, cb, root, "admissionDate", criteria.getAdmissionDate());
        return predicates;
    }

    private void addVisiblePredicate(List<Predicate> predicates, CriteriaBuilder cb, Root<Animal> root, AnimalCriteria criteria) {
        if (criteria.getVisible() == null) {
            return;
        }

        Predicate visibleMatch = cb.or(
                combineVisibleFieldPredicates(cb, root.get("arete"), criteria),
                combineVisibleFieldPredicates(cb, root.get("marca"), criteria),
                combineVisibleFieldPredicates(cb, root.get("tatuaje"), criteria)
        );
        predicates.add(visibleMatch);
    }

    private Predicate combineVisibleFieldPredicates(CriteriaBuilder cb, Path<String> field, AnimalCriteria criteria) {
        return QueryUtil.combinePredicatesAnd(cb, QueryUtil.buildPredicatesForStringFilter(cb, field, criteria.getVisible()));
    }
}

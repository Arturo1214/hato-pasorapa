package bo.pasorapa.hato.service.page;

import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.util.List;

@FunctionalInterface
public interface PredicateBuilder<T> {
    List<Predicate> build(CriteriaBuilder cb, Root<T> root);
}


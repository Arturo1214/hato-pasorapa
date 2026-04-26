package bo.pasorapa.hato.service.page;

import bo.pasorapa.hato.service.filter.QueryUtil;
import jakarta.persistence.EntityManager;
import jakarta.persistence.TypedQuery;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.jboss.logging.Logger;

public final class PageUtil {

    private static final Logger LOG = Logger.getLogger(PageUtil.class);

    private PageUtil() {
    }

    public static <T> Page<T> getPage(
            EntityManager entityManager,
            CriteriaQuery<T> criteriaQuery,
            Pageable pageable,
            PredicateBuilder<T> predicateBuilder
    ) {
        CriteriaBuilder cb = entityManager.getCriteriaBuilder();

        if (pageable.getSort() != null && !pageable.getSort().getOrders().isEmpty()) {
            Root<T> root = getRoot(criteriaQuery);
            List<jakarta.persistence.criteria.Order> orders = new ArrayList<>();
            for (Sort.Order sortOrder : pageable.getSort().getOrders()) {
                try {
                    orders.add(sortOrder.getDirection() == Sort.Direction.ASC
                            ? cb.asc(root.get(sortOrder.getProperty()))
                            : cb.desc(root.get(sortOrder.getProperty())));
                } catch (IllegalArgumentException exception) {
                    LOG.warnf("No existe la propiedad '%s' para ordenar", sortOrder.getProperty());
                }
            }
            if (!orders.isEmpty()) {
                criteriaQuery.orderBy(orders);
            }
        }

        CriteriaQuery<Long> countQuery = cb.createQuery(Long.class);
        Root<T> countRoot = countQuery.from(criteriaQuery.getResultType());
        countQuery.select(cb.count(countRoot));

        List<Predicate> countPredicates = predicateBuilder.build(cb, countRoot);
        if (!countPredicates.isEmpty()) {
            countQuery.where(QueryUtil.combinePredicatesAnd(cb, countPredicates));
        }

        long total = entityManager.createQuery(countQuery).getSingleResult();

        TypedQuery<T> typedQuery = entityManager.createQuery(criteriaQuery);
        typedQuery.setFirstResult(pageable.getPageNumber() * pageable.getPageSize());
        typedQuery.setMaxResults(pageable.getPageSize());
        List<T> content = typedQuery.getResultList();

        return new Page<>(content, pageable, total);
    }

    @SuppressWarnings("unchecked")
    private static <T> Root<T> getRoot(CriteriaQuery<T> criteriaQuery) {
        Set<Root<?>> roots = criteriaQuery.getRoots();
        if (roots == null || roots.isEmpty()) {
            throw new IllegalArgumentException("La consulta no tiene un root definido");
        }
        return (Root<T>) roots.iterator().next();
    }
}


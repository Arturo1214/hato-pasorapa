package bo.pasorapa.hato.repository;

import bo.pasorapa.hato.domain.HerdLotAssignment;
import io.quarkus.hibernate.orm.panache.PanacheRepositoryBase;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

@ApplicationScoped
public class HerdLotAssignmentRepository implements PanacheRepositoryBase<HerdLotAssignment, UUID> {

    public Optional<HerdLotAssignment> findByOperationId(UUID operationId) {
        return find("operationId", operationId).firstResultOptional();
    }

    public List<HerdLotAssignment> listChangedSince(LocalDateTime cursorUpdatedAt, UUID cursorId, int limitPlusOne) {
        if (cursorUpdatedAt == null) {
            return find("from HerdLotAssignment order by updatedAt asc, assignmentId asc").page(0, limitPlusOne).list();
        }

        UUID effectiveCursorId = cursorId == null ? new UUID(0L, 0L) : cursorId;
        return find(
                        "from HerdLotAssignment where updatedAt > ?1 or (updatedAt = ?1 and assignmentId > ?2) order by updatedAt asc, assignmentId asc",
                        cursorUpdatedAt,
                        effectiveCursorId)
                .page(0, limitPlusOne)
                .list();
    }

    public boolean hasOverlap(UUID animalUuid, LocalDate fromDate, LocalDate toDate, UUID excludedAssignmentId) {
        List<HerdLotAssignment> assignments = find("animal.uuid", animalUuid).list();
        return assignments.stream()
                .filter(assignment -> excludedAssignmentId == null || !assignment.getAssignmentId().equals(excludedAssignmentId))
                .anyMatch(assignment -> overlaps(fromDate, toDate, assignment.getFromDate(), assignment.getToDate()));
    }

    private boolean overlaps(LocalDate leftFrom, LocalDate leftTo, LocalDate rightFrom, LocalDate rightTo) {
        LocalDate effectiveLeftTo = leftTo == null ? LocalDate.MAX : leftTo;
        LocalDate effectiveRightTo = rightTo == null ? LocalDate.MAX : rightTo;
        return !leftFrom.isAfter(effectiveRightTo) && !rightFrom.isAfter(effectiveLeftTo);
    }
}

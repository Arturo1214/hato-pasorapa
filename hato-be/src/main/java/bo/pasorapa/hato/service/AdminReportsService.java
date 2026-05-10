package bo.pasorapa.hato.service;

import bo.pasorapa.hato.repository.AdminNotificationRecipientRepository;
import bo.pasorapa.hato.repository.AnimalHealthEventRepository;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.service.dto.admin.reports.HealthActivityFilter;
import bo.pasorapa.hato.service.dto.admin.reports.HealthActivityResponse;
import bo.pasorapa.hato.service.dto.admin.reports.InventoryByGanaderoFilter;
import bo.pasorapa.hato.service.dto.admin.reports.InventoryByGanaderoResponse;
import bo.pasorapa.hato.service.dto.admin.reports.NotificationReachFilter;
import bo.pasorapa.hato.service.dto.admin.reports.NotificationReachResponse;
import bo.pasorapa.hato.service.error.BusinessException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.core.Response;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.temporal.ChronoUnit;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;

@ApplicationScoped
public class AdminReportsService {

    private static final int MAX_DATE_RANGE_DAYS = 366;
    private static final BigDecimal ONE_HUNDRED = new BigDecimal("100.00");

    private final AnimalRepository animalRepository;
    private final AnimalHealthEventRepository animalHealthEventRepository;
    private final AdminNotificationRecipientRepository adminNotificationRecipientRepository;

    public AdminReportsService(
            AnimalRepository animalRepository,
            AnimalHealthEventRepository animalHealthEventRepository,
            AdminNotificationRecipientRepository adminNotificationRecipientRepository) {
        this.animalRepository = animalRepository;
        this.animalHealthEventRepository = animalHealthEventRepository;
        this.adminNotificationRecipientRepository = adminNotificationRecipientRepository;
    }

    public InventoryByGanaderoResponse getInventoryByGanadero(InventoryByGanaderoFilter filter) {
        Map<UUID, InventoryAccumulator> rowsByGanadero = new LinkedHashMap<>();
        for (AnimalRepository.InventoryCountRow row : animalRepository.listInventoryByGanadero(filter.ganaderoId, filter.active)) {
            InventoryAccumulator accumulator = rowsByGanadero.computeIfAbsent(
                    row.ganaderoId(),
                    ignored -> new InventoryAccumulator(row.ganaderoId(), row.ganaderoName()));
            accumulator.add(row);
        }
        return new InventoryByGanaderoResponse(rowsByGanadero.values().stream()
                .map(InventoryAccumulator::toResponseRow)
                .toList());
    }

    public HealthActivityResponse getHealthActivity(HealthActivityFilter filter) {
        validateRequiredDateWindow(filter.from, filter.to);
        List<HealthActivityResponse.HealthActivityRow> rows = animalHealthEventRepository
                .listHealthActivity(
                        startOfDay(filter.from),
                        endOfDay(filter.to),
                        filter.type,
                        filter.ganaderoId,
                        filter.animalUuid,
                        filter.limit)
                .stream()
                .map(row -> new HealthActivityResponse.HealthActivityRow(
                        row.eventId(),
                        row.occurredAt(),
                        row.type(),
                        row.ganaderoId(),
                        row.ganaderoName(),
                        row.animalUuid(),
                        row.animalCode(),
                        row.animalTag(),
                        row.notes()))
                .toList();
        return new HealthActivityResponse(rows);
    }

    public NotificationReachResponse getNotificationReach(NotificationReachFilter filter) {
        validateOptionalDateWindow(filter.from, filter.to);
        LocalDateTime from = filter.from == null ? null : startOfDay(filter.from);
        LocalDateTime to = filter.to == null ? null : endOfDay(filter.to);
        List<NotificationReachResponse.NotificationReachRow> rows = adminNotificationRecipientRepository
                .getNotificationReach(from, to, filter.limit)
                .stream()
                .map(row -> {
                    long pendingCount = row.totalRecipients() - row.readCount();
                    return new NotificationReachResponse.NotificationReachRow(
                            row.notificationId(),
                            row.title(),
                            row.publishedAt(),
                            row.targetingMode(),
                            row.totalRecipients(),
                            row.readCount(),
                            pendingCount,
                            calculateReadRate(row.readCount(), row.totalRecipients()));
                })
                .toList();
        return new NotificationReachResponse(rows);
    }

    private BigDecimal calculateReadRate(long readCount, long totalRecipients) {
        if (totalRecipients == 0) {
            return BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP);
        }
        return BigDecimal.valueOf(readCount)
                .multiply(ONE_HUNDRED)
                .divide(BigDecimal.valueOf(totalRecipients), 2, RoundingMode.HALF_UP);
    }

    private LocalDateTime startOfDay(LocalDate date) {
        return date.atStartOfDay();
    }

    private LocalDateTime endOfDay(LocalDate date) {
        return date.atTime(LocalTime.MAX);
    }

    private void validateOptionalDateWindow(LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            return;
        }
        validateRequiredDateWindow(from, to);
    }

    private void validateRequiredDateWindow(LocalDate from, LocalDate to) {
        if (from == null || to == null) {
            throw new BusinessException(
                    "REPORT_DATE_RANGE_REQUIRED",
                    "Los parámetros from y to son obligatorios para este reporte.",
                    Response.Status.BAD_REQUEST);
        }
        if (from.isAfter(to)) {
            throw new BusinessException(
                    "INVALID_REPORT_DATE_RANGE",
                    "El parámetro from no puede ser posterior a to.",
                    Response.Status.BAD_REQUEST);
        }
        if (ChronoUnit.DAYS.between(from, to) + 1 > MAX_DATE_RANGE_DAYS) {
            throw new BusinessException(
                    "REPORT_DATE_RANGE_TOO_LARGE",
                    "El rango de fechas no puede superar 366 días.",
                    Response.Status.BAD_REQUEST);
        }
    }

    private static class InventoryAccumulator {
        private final UUID ganaderoId;
        private final String ganaderoName;
        private long total;
        private long active;
        private long inactive;
        private final Map<String, Long> byCategory = new LinkedHashMap<>();
        private final Map<String, Long> bySex = new LinkedHashMap<>();

        private InventoryAccumulator(UUID ganaderoId, String ganaderoName) {
            this.ganaderoId = ganaderoId;
            this.ganaderoName = ganaderoName;
        }

        private void add(AnimalRepository.InventoryCountRow row) {
            total += row.count();
            if (Boolean.TRUE.equals(row.active())) {
                active += row.count();
            } else {
                inactive += row.count();
            }
            byCategory.merge(row.category().name(), row.count(), Long::sum);
            if (row.sex() != null) {
                bySex.merge(row.sex().name(), row.count(), Long::sum);
            }
        }

        private InventoryByGanaderoResponse.InventoryRow toResponseRow() {
            return new InventoryByGanaderoResponse.InventoryRow(
                    ganaderoId,
                    ganaderoName,
                    total,
                    active,
                    inactive,
                    byCategory.entrySet().stream().collect(Collectors.toMap(
                            Map.Entry::getKey,
                            Map.Entry::getValue,
                            Long::sum,
                            LinkedHashMap::new)),
                    bySex.entrySet().stream().collect(Collectors.toMap(
                            Map.Entry::getKey,
                            Map.Entry::getValue,
                            Long::sum,
                            LinkedHashMap::new)));
        }
    }
}

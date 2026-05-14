package bo.pasorapa.hato.service;

import bo.pasorapa.hato.domain.AnimalHealthEvent;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.enumeration.AnimalEventType;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.repository.AdminNotificationRecipientRepository;
import bo.pasorapa.hato.repository.AnimalEventLogRepository;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.mapper.AnimalHealthEventMapper;
import bo.pasorapa.hato.service.dto.ganadero.dashboard.AnimalsSummaryResponse;
import bo.pasorapa.hato.service.dto.ganadero.dashboard.UpcomingEventResponse;
import bo.pasorapa.hato.service.dto.ganadero.dashboard.UpcomingVisitResponse;
import bo.pasorapa.hato.service.dto.ganadero.dashboard.UnreadCountResponse;
import bo.pasorapa.hato.service.error.BusinessException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.ws.rs.core.Response;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

@ApplicationScoped
public class GanaderoDashboardService {

    private final AnimalRepository animalRepository;
    private final AnimalEventLogRepository animalEventLogRepository;
    private final AdminNotificationRecipientRepository adminNotificationRecipientRepository;
    private final UserRepository userRepository;
    private final GanaderoRepository ganaderoRepository;
    private final AnimalHealthEventMapper animalHealthEventMapper;

    public GanaderoDashboardService(
            AnimalRepository animalRepository,
            AnimalEventLogRepository animalEventLogRepository,
            AdminNotificationRecipientRepository adminNotificationRecipientRepository,
            UserRepository userRepository,
            GanaderoRepository ganaderoRepository,
            AnimalHealthEventMapper animalHealthEventMapper) {
        this.animalRepository = animalRepository;
        this.animalEventLogRepository = animalEventLogRepository;
        this.adminNotificationRecipientRepository = adminNotificationRecipientRepository;
        this.userRepository = userRepository;
        this.ganaderoRepository = ganaderoRepository;
        this.animalHealthEventMapper = animalHealthEventMapper;
    }

    public AnimalsSummaryResponse animalsSummary(UUID currentUserId) {
        UUID ganaderoId = resolveGanaderoId(currentUserId);
        return new AnimalsSummaryResponse(
                buildCount(ganaderoId, AnimalSex.MACHO),
                buildCount(ganaderoId, AnimalSex.HEMBRA));
    }

    public List<UpcomingEventResponse> upcomingEvents(UUID currentUserId, int limit) {
        UUID ganaderoId = resolveGanaderoId(currentUserId);
        return animalEventLogRepository.findUpcomingGeneralForGanadero(ganaderoId, LocalDateTime.now(), limit).stream()
                .map(event -> new UpcomingEventResponse(
                        event.getEventId(),
                        AnimalEventType.valueOf(event.getEventType()).name(),
                        event.getOccurredAt().toLocalDate(),
                        event.getNotes()))
                .toList();
    }

    public UnreadCountResponse unreadCount(UUID currentUserId) {
        return new UnreadCountResponse((int) adminNotificationRecipientRepository.countByRecipientUserIdAndReadFalse(currentUserId));
    }

    public List<UpcomingVisitResponse> upcomingVisits(UUID currentUserId, int limit) {
        UUID ganaderoId = resolveGanaderoId(currentUserId);
        return animalEventLogRepository.findUpcomingHealthVisits(ganaderoId, limit).stream()
                .map(animalHealthEventMapper::toAnimalHealthEvent)
                .map(this::toUpcomingVisit)
                .filter(item -> item.plannedDate() != null && !item.plannedDate().isBefore(LocalDate.now()))
                .toList();
    }

    private AnimalsSummaryResponse.CategoryCount buildCount(UUID ganaderoId, AnimalSex sex) {
        return new AnimalsSummaryResponse.CategoryCount(
                sex == AnimalSex.HEMBRA ? (int) animalRepository.countByOwnerAndSexAndCategory(ganaderoId, sex, AnimalCategory.VAQUILLONA) : 0,
                sex == AnimalSex.HEMBRA ? (int) animalRepository.countByOwnerAndSexAndCategory(ganaderoId, sex, AnimalCategory.VACA) : 0,
                sex == AnimalSex.MACHO ? (int) animalRepository.countByOwnerAndSexAndCategory(ganaderoId, sex, AnimalCategory.TORO) : 0,
                sex == AnimalSex.MACHO ? (int) animalRepository.countByOwnerAndSexAndCategory(ganaderoId, sex, AnimalCategory.TERNERO) : 0,
                sex == AnimalSex.HEMBRA ? (int) animalRepository.countByOwnerAndSexAndCategory(ganaderoId, sex, AnimalCategory.TERNERA) : 0,
                sex == AnimalSex.MACHO ? (int) animalRepository.countByOwnerAndSexAndCategory(ganaderoId, sex, AnimalCategory.BUEY) : 0);
    }

    private UpcomingVisitResponse toUpcomingVisit(AnimalHealthEvent event) {
        OffsetDateTime nextDueAt = animalHealthEventMapper.readNextDueAt(animalHealthEventMapper.readMetadataJson(event.getMetadataJson()));
        String status = nextDueAt == null ? "COMPLETADA" : "PENDIENTE";
        return new UpcomingVisitResponse(event.getEventId(), event.getHealthEventType().name(), nextDueAt == null ? null : nextDueAt.toLocalDate(), status);
    }

    private UUID resolveGanaderoId(UUID currentUserId) {
        User user = userRepository.findByIdOptional(currentUserId)
                .orElseThrow(() -> new BusinessException("USER_NOT_FOUND", "No encontramos el usuario autenticado.", Response.Status.NOT_FOUND));
        return ganaderoRepository.findByEmail(user.getEmail())
                .orElseThrow(() -> new BusinessException("GANADERO_NOT_FOUND", "No encontramos el ganadero autenticado.", Response.Status.NOT_FOUND))
                .getId();
    }
}

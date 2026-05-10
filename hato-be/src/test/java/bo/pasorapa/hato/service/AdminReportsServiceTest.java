package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import bo.pasorapa.hato.domain.AdminNotification;
import bo.pasorapa.hato.domain.AdminNotificationRecipient;
import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.AnimalHealthEvent;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.enumeration.AdminNotificationTargetingMode;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalHealthEventType;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.repository.AdminNotificationRecipientRepository;
import bo.pasorapa.hato.repository.AdminNotificationRepository;
import bo.pasorapa.hato.repository.AnimalHealthEventRepository;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.dto.admin.reports.HealthActivityFilter;
import bo.pasorapa.hato.service.dto.admin.reports.InventoryByGanaderoFilter;
import bo.pasorapa.hato.service.dto.admin.reports.NotificationReachFilter;
import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AdminReportsServiceTest {

    @Inject
    AdminReportsService adminReportsService;

    @Inject
    AnimalRepository animalRepository;

    @Inject
    AnimalHealthEventRepository animalHealthEventRepository;

    @Inject
    AdminNotificationRepository adminNotificationRepository;

    @Inject
    AdminNotificationRecipientRepository adminNotificationRecipientRepository;

    @Inject
    GanaderoRepository ganaderoRepository;

    @Inject
    UserRepository userRepository;

    @Inject
    IntegrationDatabaseCleaner integrationDatabaseCleaner;

    private UUID adminUserId;
    private UUID recipientAId;
    private UUID recipientBId;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            integrationDatabaseCleaner.clean();
            adminUserId = persistUser("reports-admin", Role.ADMIN);
            recipientAId = persistUser("reports-recipient-a", Role.GANADERO);
            recipientBId = persistUser("reports-recipient-b", Role.GANADERO);
        });
    }

    @Test
    void shouldGroupInventoryByGanaderoWithCategorySexAndActiveFilters() {
        UUID ganaderoAId = UUID.randomUUID();
        UUID ganaderoBId = UUID.randomUUID();
        QuarkusTransaction.requiringNew().run(() -> {
            Ganadero ganaderoA = persistGanadero(ganaderoAId, "Ganadera Norte");
            Ganadero ganaderoB = persistGanadero(ganaderoBId, "Ganadera Sur");
            persistAnimal("A-001", ganaderoA, AnimalCategory.VACA, AnimalSex.HEMBRA, true);
            persistAnimal("A-002", ganaderoA, AnimalCategory.TORO, AnimalSex.MACHO, true);
            persistAnimal("A-003", ganaderoA, AnimalCategory.VACA, AnimalSex.HEMBRA, false);
            persistAnimal("B-001", ganaderoB, AnimalCategory.TERNERO, AnimalSex.MACHO, true);
        });

        InventoryByGanaderoFilter allFilter = new InventoryByGanaderoFilter();
        var allRows = adminReportsService.getInventoryByGanadero(allFilter).rows();
        assertEquals(2, allRows.size());
        var ganaderoA = allRows.getFirst();
        assertEquals(ganaderoAId, ganaderoA.ganaderoId());
        assertEquals("Ganadera Norte", ganaderoA.ganaderoName());
        assertEquals(3, ganaderoA.total());
        assertEquals(2, ganaderoA.active());
        assertEquals(1, ganaderoA.inactive());
        assertEquals(2, ganaderoA.byCategory().get("VACA"));
        assertEquals(1, ganaderoA.byCategory().get("TORO"));
        assertEquals(2, ganaderoA.bySex().get("HEMBRA"));
        assertEquals(1, ganaderoA.bySex().get("MACHO"));

        InventoryByGanaderoFilter activeGanaderoFilter = new InventoryByGanaderoFilter();
        activeGanaderoFilter.ganaderoId = ganaderoAId;
        activeGanaderoFilter.active = true;
        var filteredRows = adminReportsService.getInventoryByGanadero(activeGanaderoFilter).rows();
        assertEquals(1, filteredRows.size());
        assertEquals(2, filteredRows.getFirst().total());
        assertEquals(1, filteredRows.getFirst().byCategory().get("VACA"));
    }

    @Test
    void shouldReturnHealthActivityRowsWithFiltersOrderingAndLimit() {
        UUID ganaderoAId = UUID.randomUUID();
        UUID ganaderoBId = UUID.randomUUID();
        UUID animalAUuid = UUID.randomUUID();
        QuarkusTransaction.requiringNew().run(() -> {
            Ganadero ganaderoA = persistGanadero(ganaderoAId, "Ganadera Norte");
            Ganadero ganaderoB = persistGanadero(ganaderoBId, "Ganadera Sur");
            Animal animalA = persistAnimal("HA-001", animalAUuid, ganaderoA, AnimalCategory.VACA, AnimalSex.HEMBRA, true);
            Animal animalB = persistAnimal("HB-001", UUID.randomUUID(), ganaderoB, AnimalCategory.TORO, AnimalSex.MACHO, true);
            persistHealthEvent(animalA, AnimalHealthEventType.VACCINATION, LocalDateTime.of(2026, 5, 3, 9, 0), "Vacuna aftosa");
            persistHealthEvent(animalA, AnimalHealthEventType.DEWORMING, LocalDateTime.of(2026, 5, 4, 10, 0), "Desparasitación");
            persistHealthEvent(animalB, AnimalHealthEventType.VACCINATION, LocalDateTime.of(2026, 5, 5, 8, 0), "Otra estancia");
        });

        HealthActivityFilter filter = new HealthActivityFilter();
        filter.from = LocalDate.of(2026, 5, 1);
        filter.to = LocalDate.of(2026, 5, 10);
        filter.type = AnimalHealthEventType.VACCINATION;
        filter.ganaderoId = ganaderoAId;
        filter.limit = 10;
        var rows = adminReportsService.getHealthActivity(filter).rows();
        assertEquals(1, rows.size());
        assertEquals(AnimalHealthEventType.VACCINATION, rows.getFirst().type());
        assertEquals(ganaderoAId, rows.getFirst().ganaderoId());
        assertEquals(animalAUuid, rows.getFirst().animalUuid());
        assertEquals("HA-001", rows.getFirst().animalCode());
        assertEquals("Vacuna aftosa", rows.getFirst().notes());

        HealthActivityFilter limitedFilter = new HealthActivityFilter();
        limitedFilter.from = LocalDate.of(2026, 5, 1);
        limitedFilter.to = LocalDate.of(2026, 5, 10);
        limitedFilter.ganaderoId = ganaderoAId;
        limitedFilter.limit = 1;
        var limitedRows = adminReportsService.getHealthActivity(limitedFilter).rows();
        assertEquals(1, limitedRows.size());
        assertEquals(AnimalHealthEventType.DEWORMING, limitedRows.getFirst().type());
    }

    @Test
    void shouldReturnNotificationReachWithDateFilteringLimitsAndReadRate() {
        UUID newestNotificationId = UUID.randomUUID();
        QuarkusTransaction.requiringNew().run(() -> {
            AdminNotification oldNotification = persistNotification(UUID.randomUUID(), "Campaña antigua", LocalDateTime.of(2026, 4, 20, 8, 0));
            persistRecipient(oldNotification, recipientAId, true);

            AdminNotification firstNotification = persistNotification(UUID.randomUUID(), "Vacunación mayo", LocalDateTime.of(2026, 5, 3, 8, 0));
            persistRecipient(firstNotification, recipientAId, true);
            persistRecipient(firstNotification, recipientBId, false);

            AdminNotification newestNotification = persistNotification(newestNotificationId, "Asamblea", LocalDateTime.of(2026, 5, 6, 8, 0));
            persistRecipient(newestNotification, recipientAId, true);
            persistRecipient(newestNotification, recipientBId, true);
        });

        NotificationReachFilter filter = new NotificationReachFilter();
        filter.from = LocalDate.of(2026, 5, 1);
        filter.to = LocalDate.of(2026, 5, 10);
        filter.limit = 2;
        var rows = adminReportsService.getNotificationReach(filter).rows();
        assertEquals(2, rows.size());
        assertEquals(newestNotificationId, rows.getFirst().notificationId());
        assertEquals("Asamblea", rows.getFirst().title());
        assertEquals(AdminNotificationTargetingMode.ALL_ACTIVE_GANADEROS, rows.getFirst().targetingMode());
        assertEquals(2, rows.getFirst().totalRecipients());
        assertEquals(2, rows.getFirst().readCount());
        assertEquals(0, rows.getFirst().pendingCount());
        assertEquals(new BigDecimal("100.00"), rows.getFirst().readRate());
        assertEquals("Vacunación mayo", rows.get(1).title());
        assertEquals(new BigDecimal("50.00"), rows.get(1).readRate());
    }

    @Test
    void shouldRejectInvalidReportDateWindows() {
        HealthActivityFilter reversedHealthFilter = new HealthActivityFilter();
        reversedHealthFilter.from = LocalDate.of(2026, 5, 10);
        reversedHealthFilter.to = LocalDate.of(2026, 5, 1);
        BusinessException reversedError = assertThrows(
                BusinessException.class,
                () -> adminReportsService.getHealthActivity(reversedHealthFilter));
        assertEquals("INVALID_REPORT_DATE_RANGE", reversedError.code());

        NotificationReachFilter tooLargeFilter = new NotificationReachFilter();
        tooLargeFilter.from = LocalDate.of(2025, 1, 1);
        tooLargeFilter.to = LocalDate.of(2026, 5, 10);
        BusinessException tooLargeError = assertThrows(
                BusinessException.class,
                () -> adminReportsService.getNotificationReach(tooLargeFilter));
        assertEquals("REPORT_DATE_RANGE_TOO_LARGE", tooLargeError.code());
    }

    private UUID persistUser(String username, Role role) {
        User user = new User();
        user.setId(UUID.randomUUID());
        user.setUsername(username);
        user.setEmail(username + "@hato.bo");
        user.setDisplayName(username);
        user.setPasswordHash("hash-" + username);
        user.setRole(role);
        user.setStatus(UserStatus.ACTIVE);
        userRepository.persist(user);
        return user.getId();
    }

    private Ganadero persistGanadero(UUID id, String name) {
        Ganadero ganadero = new Ganadero();
        ganadero.setId(id);
        ganadero.setBusinessIdentifier("BIZ-" + id.toString().substring(0, 8));
        ganadero.setName(name);
        ganadero.setEmail(id.toString().substring(0, 8) + "@ganadero.bo");
        ganadero.setActive(true);
        ganaderoRepository.persist(ganadero);
        return ganadero;
    }

    private Animal persistAnimal(String code, Ganadero ganadero, AnimalCategory category, AnimalSex sex, boolean active) {
        return persistAnimal(code, UUID.randomUUID(), ganadero, category, sex, active);
    }

    private Animal persistAnimal(String code, UUID uuid, Ganadero ganadero, AnimalCategory category, AnimalSex sex, boolean active) {
        Animal animal = new Animal();
        animal.setUuid(uuid);
        animal.setCode(code);
        animal.setTag("TAG-" + code);
        animal.setOwnerGanadero(ganadero);
        animal.setCategory(category);
        animal.setSex(sex);
        animal.setActive(active);
        animal.setAdmissionDate(LocalDate.of(2026, 1, 1));
        animalRepository.persist(animal);
        return animal;
    }

    private void persistHealthEvent(Animal animal, AnimalHealthEventType type, LocalDateTime occurredAt, String notes) {
        AnimalHealthEvent event = new AnimalHealthEvent();
        event.setEventId(UUID.randomUUID());
        event.setAnimal(animal);
        event.setHealthEventType(type);
        event.setOccurredAt(occurredAt);
        event.setClientCreatedAt(occurredAt);
        event.setNotes(notes);
        event.setPerformedByUserId(adminUserId);
        event.setSourceChannel("WEB");
        event.setOperationId(UUID.randomUUID());
        animalHealthEventRepository.persist(event);
    }

    private AdminNotification persistNotification(UUID id, String title, LocalDateTime publishedAt) {
        AdminNotification notification = new AdminNotification();
        notification.setId(id);
        notification.setTitle(title);
        notification.setBody("Mensaje " + title);
        notification.setTargetingMode(AdminNotificationTargetingMode.ALL_ACTIVE_GANADEROS);
        notification.setRecipientCount(0);
        notification.setCreatedByUserId(adminUserId);
        notification.setPublishedAt(publishedAt);
        adminNotificationRepository.persist(notification);
        return notification;
    }

    private void persistRecipient(AdminNotification notification, UUID recipientUserId, boolean read) {
        AdminNotificationRecipient recipient = new AdminNotificationRecipient();
        recipient.setId(UUID.randomUUID());
        recipient.setNotification(notification);
        recipient.setRecipientUserId(recipientUserId);
        recipient.setRead(read);
        adminNotificationRecipientRepository.persist(recipient);
    }
}

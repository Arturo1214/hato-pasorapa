package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import bo.pasorapa.hato.domain.AdminNotification;
import bo.pasorapa.hato.domain.AdminNotificationRecipient;
import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.service.model.AnimalEvent;
import bo.pasorapa.hato.service.model.AnimalHealthEvent;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.enumeration.AdminNotificationTargetingMode;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalEventType;
import bo.pasorapa.hato.domain.enumeration.AnimalHealthEventType;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.repository.AdminNotificationRecipientRepository;
import bo.pasorapa.hato.repository.AdminNotificationRepository;
import bo.pasorapa.hato.repository.AnimalEventLogRepository;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import bo.pasorapa.hato.service.mapper.AnimalEventMapper;
import bo.pasorapa.hato.service.mapper.AnimalHealthEventMapper;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class GanaderoDashboardServiceTest {

    private static final UUID USER_ID = UUID.fromString("12121212-1212-4212-8212-121212121212");
    private static final UUID GANADERO_ID = UUID.fromString("13131313-1313-4313-8313-131313131313");
    private static final UUID OTHER_GANADERO_ID = UUID.fromString("14141414-1414-4414-8414-141414141414");

    @Inject GanaderoDashboardService ganaderoDashboardService;
    @Inject AnimalRepository animalRepository;
    @Inject AnimalEventLogRepository animalEventLogRepository;
    @Inject AnimalEventMapper animalEventMapper;
    @Inject AnimalHealthEventMapper animalHealthEventMapper;
    @Inject AdminNotificationRepository adminNotificationRepository;
    @Inject AdminNotificationRecipientRepository adminNotificationRecipientRepository;
    @Inject GanaderoRepository ganaderoRepository;
    @Inject UserRepository userRepository;
    @Inject IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            integrationDatabaseCleaner.clean();
            ganaderoRepository.persist(buildGanadero(GANADERO_ID, "ganadero-dashboard@hato.bo", "Ganadero Dashboard"));
            ganaderoRepository.persist(buildGanadero(OTHER_GANADERO_ID, "otro@hato.bo", "Ganadero Otro"));
            userRepository.persist(buildUser());

            animalRepository.persist(buildAnimal(UUID.fromString("20000000-0000-4000-8000-000000000001"), GANADERO_ID, AnimalCategory.TORO, AnimalSex.MACHO));
            animalRepository.persist(buildAnimal(UUID.fromString("20000000-0000-4000-8000-000000000002"), GANADERO_ID, AnimalCategory.TERNERO, AnimalSex.MACHO));
            animalRepository.persist(buildAnimal(UUID.fromString("20000000-0000-4000-8000-000000000003"), GANADERO_ID, AnimalCategory.VACA, AnimalSex.HEMBRA));
            animalRepository.persist(buildAnimal(UUID.fromString("20000000-0000-4000-8000-000000000004"), GANADERO_ID, AnimalCategory.VAQUILLONA, AnimalSex.HEMBRA));
            animalRepository.persist(buildAnimal(UUID.fromString("20000000-0000-4000-8000-000000000005"), GANADERO_ID, AnimalCategory.TERNERA, AnimalSex.HEMBRA));
            animalRepository.persist(buildAnimal(UUID.fromString("20000000-0000-4000-8000-000000000006"), GANADERO_ID, AnimalCategory.TORO, null));
            animalRepository.persist(buildAnimal(UUID.fromString("20000000-0000-4000-8000-000000000007"), OTHER_GANADERO_ID, AnimalCategory.TORO, AnimalSex.MACHO));

            Animal ownAnimal = animalRepository.findByUuid(UUID.fromString("20000000-0000-4000-8000-000000000001")).orElseThrow();
            Animal otherAnimal = animalRepository.findByUuid(UUID.fromString("20000000-0000-4000-8000-000000000007")).orElseThrow();
            animalEventLogRepository.persist(animalEventMapper.toAnimalEventLog(buildAnimalEvent(UUID.fromString("30000000-0000-4000-8000-000000000001"), ownAnimal, LocalDateTime.of(2099, 1, 10, 9, 0), "Evento propio 1")));
            animalEventLogRepository.persist(animalEventMapper.toAnimalEventLog(buildAnimalEvent(UUID.fromString("30000000-0000-4000-8000-000000000002"), ownAnimal, LocalDateTime.of(2099, 1, 11, 9, 0), "Evento propio 2")));
            animalEventLogRepository.persist(animalEventMapper.toAnimalEventLog(buildAnimalEvent(UUID.fromString("30000000-0000-4000-8000-000000000003"), otherAnimal, LocalDateTime.of(2099, 1, 9, 9, 0), "Evento ajeno")));
            animalEventLogRepository.persist(animalEventMapper.toAnimalEventLog(buildAnimalEvent(UUID.fromString("30000000-0000-4000-8000-000000000004"), ownAnimal, LocalDateTime.of(2000, 1, 1, 9, 0), "Evento pasado")));

            animalEventLogRepository.persist(animalHealthEventMapper.toAnimalEventLog(buildHealthEvent(
                    UUID.fromString("40000000-0000-4000-8000-000000000001"),
                    ownAnimal,
                    LocalDateTime.of(2099, 2, 10, 9, 0),
                    "VISIT-1",
                    "STARTED",
                    "2099-02-20T00:00:00Z")));
            animalEventLogRepository.persist(animalHealthEventMapper.toAnimalEventLog(buildHealthEvent(
                    UUID.fromString("40000000-0000-4000-8000-000000000002"),
                    ownAnimal,
                    LocalDateTime.of(2099, 2, 11, 9, 0),
                    "VISIT-2",
                    "FOLLOW_UP_REQUIRED",
                    "2099-02-21T00:00:00Z")));
            animalEventLogRepository.persist(animalHealthEventMapper.toAnimalEventLog(buildHealthEvent(
                    UUID.fromString("40000000-0000-4000-8000-000000000003"),
                    ownAnimal,
                    LocalDateTime.of(2099, 2, 12, 9, 0),
                    "VISIT-3",
                    "CLOSED",
                    null)));
            animalEventLogRepository.persist(animalHealthEventMapper.toAnimalEventLog(buildHealthEvent(
                    UUID.fromString("40000000-0000-4000-8000-000000000004"),
                    ownAnimal,
                    LocalDateTime.of(2099, 2, 13, 9, 0),
                    "VISIT-4",
                    "FOLLOW_UP_REQUIRED",
                    "2000-02-21T00:00:00Z")));

            adminNotificationRecipientRepository.persist(buildNotificationRecipient(UUID.fromString("50000000-0000-4000-8000-000000000001"), USER_ID, false));
            adminNotificationRecipientRepository.persist(buildNotificationRecipient(UUID.fromString("50000000-0000-4000-8000-000000000002"), USER_ID, false));
            adminNotificationRecipientRepository.persist(buildNotificationRecipient(UUID.fromString("50000000-0000-4000-8000-000000000003"), USER_ID, true));
        });
    }

    @Test
    void shouldBuildAnimalsSummaryFromAuthenticatedGanadero() {
        var response = QuarkusTransaction.requiringNew().call(() -> ganaderoDashboardService.animalsSummary(USER_ID));

        assertEquals(0, response.machos().vaquillas());
        assertEquals(0, response.machos().vacas());
        assertEquals(1, response.machos().toros());
        assertEquals(1, response.machos().terneros());
        assertEquals(0, response.machos().terneras());
        assertEquals(0, response.machos().bueyes());
        assertEquals(1, response.hembras().vaquillas());
        assertEquals(1, response.hembras().vacas());
        assertEquals(0, response.hembras().toros());
        assertEquals(0, response.hembras().terneros());
        assertEquals(1, response.hembras().terneras());
        assertEquals(0, response.hembras().bueyes());
    }

    @Test
    void shouldReturnUnreadCountUpcomingEventsAndUpcomingVisitsForAuthenticatedGanadero() {
        var unread = QuarkusTransaction.requiringNew().call(() -> ganaderoDashboardService.unreadCount(USER_ID));
        var events = QuarkusTransaction.requiringNew().call(() -> ganaderoDashboardService.upcomingEvents(USER_ID, 5));
        var visits = QuarkusTransaction.requiringNew().call(() -> ganaderoDashboardService.upcomingVisits(USER_ID, 5));

        assertEquals(2, unread.count());
        assertEquals(List.of("Evento propio 1", "Evento propio 2"), events.stream().map(item -> item.description()).toList());
        assertEquals(List.of("PENDIENTE", "PENDIENTE"), visits.stream().map(item -> item.status()).toList());
        assertEquals(List.of(LocalDate.of(2099, 2, 20), LocalDate.of(2099, 2, 21)), visits.stream().map(item -> item.plannedDate()).toList());
    }

    private User buildUser() {
        User user = new User();
        user.setId(USER_ID);
        user.setUsername("ganadero-dashboard");
        user.setEmail("ganadero-dashboard@hato.bo");
        user.setDisplayName("Ganadero Dashboard");
        user.setRole(Role.GANADERO);
        user.setStatus(UserStatus.ACTIVE);
        user.setPasswordHash("hash");
        return user;
    }

    private Ganadero buildGanadero(UUID id, String email, String name) {
        Ganadero ganadero = new Ganadero();
        ganadero.setId(id);
        ganadero.setBusinessIdentifier("NIT-" + id.toString().substring(0, 8));
        ganadero.setName(name);
        ganadero.setEmail(email);
        ganadero.setActive(true);
        return ganadero;
    }

    private Animal buildAnimal(UUID uuid, UUID ownerId, AnimalCategory category, AnimalSex sex) {
        Animal animal = new Animal();
        animal.setUuid(uuid);
        animal.setCode("CODE-" + uuid);
        animal.setTag("TAG-" + uuid);
        animal.setArete("AR-" + uuid);
        animal.setAreteNormalized(animal.getArete().toLowerCase());
        animal.setMarca("Marca " + uuid.toString().substring(0, 4));
        animal.setMarcaNormalized(animal.getMarca().toLowerCase());
        animal.setOwnerGanadero(ganaderoRepository.findByIdOptional(ownerId).orElseThrow());
        animal.setCategory(category);
        animal.setSex(sex);
        animal.setActive(true);
        animal.setAdmissionDate(LocalDate.of(2024, 1, 1));
        animal.setWeightKg(new BigDecimal("400.00"));
        animal.setCreatedAt(LocalDateTime.of(2026, 4, 27, 8, 0));
        animal.setUpdatedAt(LocalDateTime.of(2026, 4, 27, 8, 0));
        animal.setVersion(0L);
        return animal;
    }

    private AnimalEvent buildAnimalEvent(UUID eventId, Animal animal, LocalDateTime occurredAt, String notes) {
        AnimalEvent event = new AnimalEvent();
        event.setEventId(eventId);
        event.setAnimal(animal);
        event.setType(AnimalEventType.OBSERVATION);
        event.setOccurredAt(occurredAt);
        event.setClientCreatedAt(occurredAt);
        event.setNotes(notes);
        event.setPerformedByUserId(USER_ID);
        event.setSourceChannel("OFFLINE");
        event.setOperationId(UUID.randomUUID());
        event.setMetadataJson("{}");
        event.setCreatedAt(occurredAt);
        event.setUpdatedAt(occurredAt);
        return event;
    }

    private AnimalHealthEvent buildHealthEvent(
            UUID eventId,
            Animal animal,
            LocalDateTime occurredAt,
            String visitId,
            String status,
            String nextDueAt) {
        AnimalHealthEvent event = new AnimalHealthEvent();
        event.setEventId(eventId);
        event.setAnimal(animal);
        event.setHealthEventType(AnimalHealthEventType.FIELD_VET_VISIT);
        event.setOccurredAt(occurredAt);
        event.setClientCreatedAt(occurredAt);
        event.setNotes("Visita " + visitId);
        event.setPerformedByUserId(USER_ID);
        event.setSourceChannel("OFFLINE");
        event.setOperationId(UUID.randomUUID());
        event.setMetadataJson(toFieldVetMetadata(visitId, status, nextDueAt));
        event.setCreatedAt(occurredAt);
        event.setUpdatedAt(occurredAt);
        return event;
    }

    private AdminNotificationRecipient buildNotificationRecipient(UUID id, UUID recipientUserId, boolean read) {
        AdminNotification notification = new AdminNotification();
        notification.setId(id);
        notification.setTitle("Aviso " + id.toString().substring(0, 4));
        notification.setBody("Mensaje de tablero");
        notification.setTargetingMode(AdminNotificationTargetingMode.ALL_ACTIVE_GANADEROS);
        notification.setRecipientCount(1);
        notification.setCreatedByUserId(USER_ID);
        notification.setPublishedAt(LocalDateTime.of(2099, 3, 1, 10, 0));
        notification.setCreatedAt(LocalDateTime.of(2099, 3, 1, 10, 0));
        notification.setUpdatedAt(LocalDateTime.of(2099, 3, 1, 10, 0));
        adminNotificationRepository.persist(notification);

        AdminNotificationRecipient recipient = new AdminNotificationRecipient();
        recipient.setId(UUID.randomUUID());
        recipient.setNotification(notification);
        recipient.setRecipientUserId(recipientUserId);
        recipient.setRead(read);
        recipient.setCreatedAt(LocalDateTime.of(2099, 3, 1, 10, 0));
        recipient.setUpdatedAt(LocalDateTime.of(2099, 3, 1, 10, 0));
        return recipient;
    }

    private String toFieldVetMetadata(String visitId, String status, String nextDueAt) {
        Map<String, Object> protocol = nextDueAt == null
                ? Map.of("status", status)
                : Map.of("status", status, "nextDueAt", nextDueAt);
        return "{" +
                "\"visit\":{\"visitId\":\"" + visitId + "\"}," +
                "\"checklist\":[{\"code\":\"TEMPERATURE\",\"ok\":true}]," +
                "\"clinicalNote\":{\"reason\":\"Control\",\"findings\":\"OK\",\"plan\":\"Seguimiento\"}," +
                "\"protocol\":" + toProtocolJson(protocol) +
                "}";
    }

    private String toProtocolJson(Map<String, Object> protocol) {
        StringBuilder builder = new StringBuilder("{");
        builder.append("\"status\":\"").append(protocol.get("status")).append("\"");
        if (protocol.containsKey("nextDueAt")) {
            builder.append(",\"nextDueAt\":\"").append(protocol.get("nextDueAt")).append("\"");
        }
        builder.append('}');
        return builder.toString();
    }
}

package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import bo.pasorapa.hato.service.dto.ganadero.dashboard.AnimalsSummaryResponse;
import bo.pasorapa.hato.service.dto.ganadero.dashboard.UpcomingEventResponse;
import bo.pasorapa.hato.service.dto.ganadero.dashboard.UpcomingVisitResponse;
import bo.pasorapa.hato.service.dto.ganadero.dashboard.UnreadCountResponse;
import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class GanaderoDashboardDtosTest {

    @Test
    void shouldExposeAnimalsSummaryCategoryCounts() {
        AnimalsSummaryResponse response = new AnimalsSummaryResponse(
                new AnimalsSummaryResponse.CategoryCount(1, 2, 3, 4, 5, 6),
                new AnimalsSummaryResponse.CategoryCount(6, 5, 4, 3, 2, 1));

        assertEquals(1, response.machos().vaquillas());
        assertEquals(5, response.machos().terneras());
        assertEquals(5, response.hembras().vacas());
        assertEquals(1, response.hembras().bueyes());
    }

    @Test
    void shouldExposeUpcomingEventFields() {
        UUID id = UUID.fromString("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
        UpcomingEventResponse response = new UpcomingEventResponse(id, "GENERAL", LocalDate.of(2099, 1, 10), "Vacunación anual");

        assertEquals(id, response.id());
        assertEquals("GENERAL", response.eventType());
        assertEquals(LocalDate.of(2099, 1, 10), response.eventDate());
        assertEquals("Vacunación anual", response.description());
    }

    @Test
    void shouldExposeUnreadCountField() {
        UnreadCountResponse response = new UnreadCountResponse(3);

        assertEquals(3, response.count());
    }

    @Test
    void shouldExposeUpcomingVisitFields() {
        UUID id = UUID.fromString("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
        UpcomingVisitResponse response = new UpcomingVisitResponse(id, "FIELD_VET_VISIT", LocalDate.of(2099, 2, 20), "PENDIENTE");

        assertEquals(id, response.id());
        assertEquals("FIELD_VET_VISIT", response.controlType());
        assertEquals(LocalDate.of(2099, 2, 20), response.plannedDate());
        assertEquals("PENDIENTE", response.status());
    }
}

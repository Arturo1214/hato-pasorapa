package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import bo.pasorapa.hato.domain.Raza;
import bo.pasorapa.hato.repository.RazaRepository;
import bo.pasorapa.hato.service.dto.raza.CreateRazaRequest;
import bo.pasorapa.hato.service.dto.raza.UpdateRazaRequest;
import bo.pasorapa.hato.service.error.BusinessException;
import bo.pasorapa.hato.support.IntegrationDatabaseCleaner;
import io.quarkus.narayana.jta.QuarkusTransaction;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

@QuarkusTest
class RazaServiceTest {

    @Inject
    RazaService razaService;

    @Inject
    RazaRepository razaRepository;

    @Inject
    IntegrationDatabaseCleaner integrationDatabaseCleaner;

    @BeforeEach
    void setUp() {
        QuarkusTransaction.requiringNew().run(() -> {
            integrationDatabaseCleaner.clean();
            razaRepository.deleteAll();
        });
    }

    @Test
    void shouldCreateBreedActiveByDefaultAndRejectDuplicateIgnoringCase() {
        var created = razaService.create(new CreateRazaRequest("Brangus", "Cruza adaptada", "Bolivia", 20));

        assertEquals("Brangus", created.nombre());
        assertEquals("Cruza adaptada", created.descripcion());
        assertTrue(created.activo());
        assertEquals(20, created.sortOrder());

        BusinessException exception = assertThrows(BusinessException.class,
                () -> razaService.create(new CreateRazaRequest(" brangus ", "Duplicada", null, 21)));
        assertEquals("RAZA_DUPLICATE", exception.code());
    }

    @Test
    void shouldUpdateBreedAndKeepNormalizedUniqueness() {
        var brangus = razaService.create(new CreateRazaRequest("Brangus", null, null, 20));
        razaService.create(new CreateRazaRequest("Senepol", null, null, 21));

        var updated = razaService.update(brangus.uuid(), new UpdateRazaRequest("Braford", "Sintética", "Argentina", true, 9));

        assertEquals("Braford", updated.nombre());
        assertEquals("Sintética", updated.descripcion());
        assertEquals("Argentina", updated.origen());
        assertEquals(9, updated.sortOrder());

        BusinessException exception = assertThrows(BusinessException.class,
                () -> razaService.update(brangus.uuid(), new UpdateRazaRequest(" senepol ", null, null, true, 10)));
        assertEquals("RAZA_DUPLICATE", exception.code());
    }

    @Test
    void shouldSoftDeactivateAndExcludeFromActiveOptions() {
        var brangus = razaService.create(new CreateRazaRequest("Brangus", null, null, 20));
        razaService.create(new CreateRazaRequest("Criolla", null, "Bolivia", 1));

        var deactivated = razaService.setActive(brangus.uuid(), false);
        List<String> activeNames = razaService.listActiveOptions().stream().map(option -> option.nombre()).toList();

        assertFalse(deactivated.activo());
        assertEquals(List.of("Criolla"), activeNames);
    }
}

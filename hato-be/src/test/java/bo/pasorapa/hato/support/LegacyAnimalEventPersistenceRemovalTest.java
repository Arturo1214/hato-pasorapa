package bo.pasorapa.hato.support;

import static org.junit.jupiter.api.Assertions.assertThrows;

import org.junit.jupiter.api.Test;

class LegacyAnimalEventPersistenceRemovalTest {

    @Test
    void shouldRemoveLegacyAnimalEventRepositoriesAndJpaEntitiesFromRuntimeClasspath() {
        for (String className : new String[] {
                "bo.pasorapa.hato.repository.AnimalEventRepository",
                "bo.pasorapa.hato.repository.AnimalHealthEventRepository",
                "bo.pasorapa.hato.repository.AnimalReproductionEventRepository",
                "bo.pasorapa.hato.domain.AnimalEvent",
                "bo.pasorapa.hato.domain.AnimalHealthEvent",
                "bo.pasorapa.hato.domain.AnimalReproductionEvent"
        }) {
            assertThrows(ClassNotFoundException.class, () -> Class.forName(className));
        }
    }
}

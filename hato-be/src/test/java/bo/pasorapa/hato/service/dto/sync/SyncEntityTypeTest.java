package bo.pasorapa.hato.service.dto.sync;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class SyncEntityTypeTest {

    @Test
    void shouldExposeNotificationEntityTypeForIncrementalPullSerialization() {
        assertEquals(SyncEntityType.NOTIFICATION, SyncEntityType.valueOf("NOTIFICATION"));
        assertTrue(java.util.EnumSet.allOf(SyncEntityType.class).contains(SyncEntityType.NOTIFICATION));
    }
}

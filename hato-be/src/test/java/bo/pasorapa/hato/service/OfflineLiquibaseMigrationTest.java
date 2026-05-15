package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import liquibase.Liquibase;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;

class OfflineLiquibaseMigrationTest {

    @Test
    void shouldCreateAnimalsAndOfflineSyncFoundationTablesFromCurrentBaseline() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                "jdbc:h2:mem:offline-sync-migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "sa",
                "sa")) {
            applyChangelog(connection, "db/changelog/master.yaml");

            try (PreparedStatement statement = connection.prepareStatement(
                    """
                    SELECT COUNT(*) AS total,
                           COUNT(DISTINCT uuid) AS distinct_uuid,
                           MIN(version) AS min_version,
                           MAX(version) AS max_version,
                           MIN(updated_at) AS min_updated_at
                    FROM animals
                    """)) {
                ResultSet result = statement.executeQuery();
                assertTrue(result.next());
                assertEquals(2, result.getInt("total"));
                assertEquals(2, result.getInt("distinct_uuid"));
                assertEquals(0L, result.getLong("min_version"));
                assertEquals(0L, result.getLong("max_version"));
                assertNotNull(result.getTimestamp("min_updated_at"));
            }

            try (PreparedStatement statement = connection.prepareStatement(
                    "SELECT uuid, updated_at FROM animals WHERE code = ?")) {
                statement.setString(1, "HAT-001");
                ResultSet result = statement.executeQuery();
                assertTrue(result.next());
                assertNotNull(result.getString("uuid"));
                assertNotNull(result.getTimestamp("updated_at"));
            }

            assertTrue(tableExists(connection, "sync_operation_receipts"));
        }
    }

    private void applyChangelog(Connection connection, String changelog) throws Exception {
        Liquibase liquibase = new Liquibase(
                changelog,
                new ClassLoaderResourceAccessor(),
                DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection)));
        liquibase.update();
    }

    private boolean tableExists(Connection connection, String tableName) throws Exception {
        try (ResultSet resultSet = connection.getMetaData().getTables(null, null, tableName.toUpperCase(), null)) {
            return resultSet.next();
        }
    }
}

package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import liquibase.Liquibase;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;

class OfflineConflictResolutionMigrationTest {

    @Test
    void shouldCreateConflictAuditLedgerAndReceiptV2Columns() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                "jdbc:h2:mem:offline-conflict-resolution-v2;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "sa",
                "sa")) {
            applyChangelog(connection, "db/changelog/test/legacy-master.yaml");
            applyChangelog(connection, "db/changelog/master.yaml");

            assertTrue(tableExists(connection, "sync_conflict_audit_ledger"));
            assertTrue(columnExists(connection, "sync_operation_receipts", "operation_type"));
            assertTrue(columnExists(connection, "sync_operation_receipts", "payload_json"));
            assertTrue(indexExists(connection, "idx_sync_conflict_audit_ledger_operation"));
            assertTrue(indexExists(connection, "idx_sync_conflict_audit_ledger_retention"));
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

    private boolean columnExists(Connection connection, String tableName, String columnName) throws Exception {
        try (ResultSet resultSet = connection.getMetaData().getColumns(null, null, tableName.toUpperCase(), columnName.toUpperCase())) {
            return resultSet.next();
        }
    }

    private boolean indexExists(Connection connection, String indexName) throws Exception {
        try (ResultSet resultSet = connection.getMetaData().getIndexInfo(null, null, "SYNC_CONFLICT_AUDIT_LEDGER", false, false)) {
            while (resultSet.next()) {
                if (indexName.equalsIgnoreCase(resultSet.getString("INDEX_NAME"))) {
                    return true;
                }
            }
            return false;
        }
    }
}

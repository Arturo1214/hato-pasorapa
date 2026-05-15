package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import liquibase.Liquibase;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;

class BaselineLiquibaseMigrationTest {

    @Test
    void shouldCreateCurrentBaselineWithoutLegacyEventTablesOrViews() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                "jdbc:h2:mem:current-baseline-schema;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "sa",
                "sa")) {
            applyChangelog(connection, "db/changelog/master.yaml");

            assertTrue(tableExists(connection, "animal_event_logs"));
            assertTrue(columnExists(connection, "animal_event_logs", "event_category"));
            assertTrue(columnExists(connection, "animal_event_logs", "visit_id"));
            assertTrue(columnExists(connection, "animal_event_logs", "next_due_at"));
            assertTrue(uniqueConstraintExists(connection, "ANIMAL_EVENT_LOGS", "UK_ANIMAL_EVENT_LOGS_OPERATION_ID"));
            assertTrue(indexExists(connection, "ANIMAL_EVENT_LOGS", "IDX_ANIMAL_EVENT_LOGS_CATEGORY_TYPE_UPDATED_EVENT"));
            assertTrue(indexExists(connection, "ANIMAL_EVENT_LOGS", "IDX_ANIMAL_EVENT_LOGS_VET_PROJECTION"));

            assertFalse(tableExists(connection, "animal_events"));
            assertFalse(tableExists(connection, "animal_health_events"));
            assertFalse(tableExists(connection, "animal_reproduction_events"));
            assertFalse(tableExists(connection, "animal_events_view"));
            assertFalse(tableExists(connection, "animal_health_events_view"));
            assertFalse(tableExists(connection, "animal_reproduction_events_view"));
        }
    }

    @Test
    void shouldCreateCurrentAnimalAndReferenceSchemaInOneBaseline() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                "jdbc:h2:mem:current-baseline-reference-schema;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "sa",
                "sa")) {
            applyChangelog(connection, "db/changelog/master.yaml");

            assertTrue(tableExists(connection, "animals"));
            assertTrue(columnExists(connection, "animals", "uuid"));
            assertTrue(columnExists(connection, "animals", "owner_ganadero_id"));
            assertTrue(columnExists(connection, "animals", "sex"));
            assertTrue(columnExists(connection, "animals", "birth_date"));
            assertTrue(columnExists(connection, "animals", "breed_id"));
            assertTrue(foreignKeyExists(connection, "FK_ANIMALS_OWNER_GANADERO"));
            assertTrue(foreignKeyExists(connection, "FK_ANIMALS_BREED"));
            assertTrue(foreignKeyExists(connection, "FK_ANIMALS_MOTHER_ANIMAL_UUID"));
            assertTrue(foreignKeyExists(connection, "FK_ANIMALS_FATHER_ANIMAL_UUID"));

            assertTrue(tableExists(connection, "razas"));
            assertTrue(indexExists(connection, "RAZAS", "IDX_RAZAS_ACTIVO_SORT"));
            assertTrue(tableExists(connection, "sync_conflict_audit_ledger"));
            assertTrue(columnExists(connection, "sync_operation_receipts", "operation_type"));
            assertTrue(columnExists(connection, "sync_operation_receipts", "payload_json"));
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

    private boolean indexExists(Connection connection, String tableName, String indexName) throws Exception {
        try (ResultSet resultSet = connection.getMetaData().getIndexInfo(null, null, tableName.toUpperCase(), false, false)) {
            while (resultSet.next()) {
                if (indexName.equalsIgnoreCase(resultSet.getString("INDEX_NAME"))) {
                    return true;
                }
            }
            return false;
        }
    }

    private boolean uniqueConstraintExists(Connection connection, String tableName, String constraintName) throws Exception {
        try (var statement = connection.prepareStatement(
                "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'UNIQUE'")) {
            statement.setString(1, tableName.toUpperCase());
            statement.setString(2, constraintName.toUpperCase());
            try (ResultSet resultSet = statement.executeQuery()) {
                return resultSet.next();
            }
        }
    }

    private boolean foreignKeyExists(Connection connection, String constraintName) throws Exception {
        try (var statement = connection.prepareStatement(
                "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'")) {
            statement.setString(1, constraintName.toUpperCase());
            try (ResultSet resultSet = statement.executeQuery()) {
                return resultSet.next();
            }
        }
    }
}

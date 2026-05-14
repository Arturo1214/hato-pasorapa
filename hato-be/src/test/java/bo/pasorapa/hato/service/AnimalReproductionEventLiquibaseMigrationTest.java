package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertFalse;
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

class AnimalReproductionEventLiquibaseMigrationTest {

    @Test
    void shouldCreateAnimalReproductionLedgerWithParentageProjectionColumns() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                "jdbc:h2:mem:animal-reproduction-events-migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "sa",
                "sa")) {
            applyChangelog(connection, "db/changelog/master.yaml");

            assertFalse(tableExists(connection, "animal_reproduction_events"));
            assertTrue(tableExists(connection, "animal_event_logs"));
            assertTrue(uniqueConstraintExists(connection, "ANIMAL_EVENT_LOGS", "uk_animal_event_logs_operation_id"));
            assertTrue(indexExists(connection, "ANIMAL_EVENT_LOGS", "idx_animal_event_logs_animal_occurred_event"));
            assertTrue(indexExists(connection, "ANIMAL_EVENT_LOGS", "idx_animal_event_logs_category_type_updated_event"));
            assertTrue(columnExists(connection, "ANIMALS", "MOTHER_ANIMAL_UUID"));
            assertTrue(columnExists(connection, "ANIMALS", "FATHER_ANIMAL_UUID"));
            assertTrue(columnExists(connection, "ANIMALS", "BIRTH_DATE"));
            assertTrue(foreignKeyExists(connection, "FK_ANIMALS_MOTHER_ANIMAL_UUID"));
            assertTrue(foreignKeyExists(connection, "FK_ANIMALS_FATHER_ANIMAL_UUID"));
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
        try (ResultSet resultSet = connection.getMetaData().getColumns(null, null, tableName, columnName)) {
            return resultSet.next();
        }
    }

    private boolean indexExists(Connection connection, String tableName, String indexName) throws Exception {
        try (ResultSet resultSet = connection.getMetaData().getIndexInfo(null, null, tableName, false, false)) {
            while (resultSet.next()) {
                if (indexName.equalsIgnoreCase(resultSet.getString("INDEX_NAME"))) {
                    return true;
                }
            }
            return false;
        }
    }

    private boolean uniqueConstraintExists(Connection connection, String tableName, String constraintName) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'UNIQUE'")) {
            statement.setString(1, tableName);
            statement.setString(2, constraintName.toUpperCase());
            try (ResultSet resultSet = statement.executeQuery()) {
                return resultSet.next();
            }
        }
    }

    private boolean foreignKeyExists(Connection connection, String constraintName) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'")) {
            statement.setString(1, constraintName.toUpperCase());
            try (ResultSet resultSet = statement.executeQuery()) {
                return resultSet.next();
            }
        }
    }
}

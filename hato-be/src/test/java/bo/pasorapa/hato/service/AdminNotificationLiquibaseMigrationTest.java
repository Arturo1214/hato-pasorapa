package bo.pasorapa.hato.service;

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

class AdminNotificationLiquibaseMigrationTest {

    @Test
    void shouldCreateAdminNotificationLedgerAndRecipientPullIndex() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                "jdbc:h2:mem:admin-notifications-migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "sa",
                "sa")) {
            Liquibase liquibase = new Liquibase(
                    "db/changelog/master.yaml",
                    new ClassLoaderResourceAccessor(),
                    DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection)));
            liquibase.update();

            assertTrue(tableExists(connection, "admin_notifications"));
            assertTrue(tableExists(connection, "admin_notification_recipients"));
            assertTrue(columnExists(connection, "ADMIN_NOTIFICATION_RECIPIENTS", "READ"));
            assertTrue(indexExists(connection, "ADMIN_NOTIFICATIONS", "IDX_ADMIN_NOTIFICATIONS_UPDATED_ID"));
            assertTrue(indexExists(connection, "ADMIN_NOTIFICATION_RECIPIENTS", "IDX_ADMIN_NOTIFICATION_RECIPIENT_PULL"));
            assertTrue(uniqueConstraintExists(connection, "ADMIN_NOTIFICATION_RECIPIENTS", "UK_ADMIN_NOTIFICATION_RECIPIENT_ONCE"));
        }
    }

    private boolean tableExists(Connection connection, String tableName) throws Exception {
        try (ResultSet resultSet = connection.getMetaData().getTables(null, null, tableName.toUpperCase(), null)) {
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

    private boolean columnExists(Connection connection, String tableName, String columnName) throws Exception {
        try (ResultSet resultSet = connection.getMetaData().getColumns(null, null, tableName, columnName)) {
            return resultSet.next();
        }
    }

    private boolean uniqueConstraintExists(Connection connection, String tableName, String constraintName) throws Exception {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS WHERE TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'UNIQUE'")) {
            statement.setString(1, tableName);
            statement.setString(2, constraintName);
            try (ResultSet resultSet = statement.executeQuery()) {
                return resultSet.next();
            }
        }
    }
}

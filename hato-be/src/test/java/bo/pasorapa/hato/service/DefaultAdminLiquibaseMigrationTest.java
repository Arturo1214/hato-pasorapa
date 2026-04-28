package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import bo.pasorapa.hato.service.security.PasswordHasher;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import liquibase.Liquibase;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;

class DefaultAdminLiquibaseMigrationTest {

    private static final String JDBC_URL = "jdbc:h2:mem:default-admin-migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1";
    private static final String LEGACY_JDBC_URL = "jdbc:h2:mem:default-admin-migration-legacy;MODE=PostgreSQL;DB_CLOSE_DELAY=-1";

    @Test
    void shouldSeedDefaultAdminOnFreshInstallWithCompatiblePasswordHash() throws Exception {
        try (Connection connection = DriverManager.getConnection(JDBC_URL, "sa", "sa")) {
            applyChangelog(connection, "db/changelog/master.yaml");

            try (PreparedStatement statement = connection.prepareStatement(
                    "SELECT username, email, display_name, password_hash, role, status FROM users WHERE username = ?")) {
                statement.setString(1, "root-admin");
                try (ResultSet result = statement.executeQuery()) {
                    assertTrue(result.next());
                    assertEquals("root-admin@hato.bo", result.getString("email"));
                    assertEquals("Root Admin", result.getString("display_name"));
                    assertEquals("ADMIN", result.getString("role"));
                    assertEquals("ACTIVE", result.getString("status"));
                    assertTrue(new PasswordHasher().matches("RootAdmin9", result.getString("password_hash")));
                    assertFalse(result.next());
                }
            }
        }
    }

    @Test
    void shouldNotDuplicateAdminWhenLegacyDatabaseAlreadyHasActiveAdmin() throws Exception {
        try (Connection connection = DriverManager.getConnection(LEGACY_JDBC_URL, "sa", "sa")) {
            applyChangelog(connection, "db/changelog/test/legacy-master.yaml");

            try (PreparedStatement statement = connection.prepareStatement(
                    """
                    INSERT INTO users (id, username, email, display_name, password_hash, role, status, version, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """)) {
                statement.setObject(1, java.util.UUID.fromString("11111111-1111-1111-1111-111111111111"));
                statement.setString(2, "existing-admin");
                statement.setString(3, "existing-admin@hato.bo");
                statement.setString(4, "Existing Admin");
                statement.setString(5, new PasswordHasher().hash("Existing99"));
                statement.setString(6, "ADMIN");
                statement.setString(7, "ACTIVE");
                statement.setLong(8, 0L);
                statement.executeUpdate();
            }

            applyChangelog(connection, "db/changelog/master.yaml");

            try (PreparedStatement statement = connection.prepareStatement(
                    "SELECT COUNT(*) FROM users WHERE role = 'ADMIN' AND status = 'ACTIVE'")) {
                try (ResultSet result = statement.executeQuery()) {
                    assertTrue(result.next());
                    assertEquals(1, result.getInt(1));
                }
            }
        }
    }

    private void applyChangelog(Connection connection, String changelog) throws Exception {
        Liquibase liquibase = new Liquibase(
                changelog,
                new ClassLoaderResourceAccessor(),
                DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection)));
        liquibase.update();
    }
}

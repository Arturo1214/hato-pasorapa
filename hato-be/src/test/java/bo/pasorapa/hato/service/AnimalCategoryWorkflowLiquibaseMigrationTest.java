package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.sql.Date;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import liquibase.Liquibase;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;

class AnimalCategoryWorkflowLiquibaseMigrationTest {

    @Test
    void shouldBackfillBirthDateForMaleCalfWhenApplyingChangeset015() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                "jdbc:h2:mem:animal-category-workflow-migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "sa",
                "sa")) {
            applyLiquibase(connection, "db/changelog/test/pre-015-master.yaml");

            Date admissionDate = Date.valueOf("2024-10-15");
            try (PreparedStatement statement = connection.prepareStatement(
                    """
                    UPDATE animals
                    SET category = ?, sex = ?, birth_date = NULL, admission_date = ?
                    WHERE id = ?
                    """)) {
                statement.setString(1, "CALF");
                statement.setString(2, "MACHO");
                statement.setDate(3, admissionDate);
                statement.setLong(4, 1L);
                statement.executeUpdate();
            }

            applyLiquibase(connection, "db/changelog/015-animal-category-workflow-v2.yaml");

            try (PreparedStatement statement = connection.prepareStatement(
                    "SELECT category, birth_date FROM animals WHERE id = ?")) {
                statement.setLong(1, 1L);

                try (ResultSet resultSet = statement.executeQuery()) {
                    assertTrue(resultSet.next());
                    assertEquals("TERNERO", resultSet.getString("category"));
                    assertNotNull(resultSet.getDate("birth_date"));
                    assertEquals(Date.valueOf("2024-04-15"), resultSet.getDate("birth_date"));
                }
            }
        }
    }

    private void applyLiquibase(Connection connection, String changeLog) throws Exception {
        Liquibase liquibase = new Liquibase(
                changeLog,
                new ClassLoaderResourceAccessor(),
                DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection)));
        liquibase.update();
    }
}

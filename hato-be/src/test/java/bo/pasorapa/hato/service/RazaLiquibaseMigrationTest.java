package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.List;
import liquibase.Liquibase;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;

class RazaLiquibaseMigrationTest {

    @Test
    void shouldCreateRazasTableAndSeedCriollaFirst() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                "jdbc:h2:mem:raza-catalog-migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "sa",
                "sa")) {
            applyLiquibase(connection, "db/changelog/master.yaml");

            List<String> names = new ArrayList<>();
            try (PreparedStatement statement = connection.prepareStatement(
                    "SELECT nombre FROM razas WHERE activo = TRUE ORDER BY sort_order ASC, nombre ASC");
                    ResultSet resultSet = statement.executeQuery()) {
                while (resultSet.next()) {
                    names.add(resultSet.getString("nombre"));
                }
            }

            assertEquals("Criolla", names.getFirst());
            assertEquals(List.of(
                    "Criolla",
                    "Nelore",
                    "Brahman",
                    "Gyr",
                    "Holstein",
                    "Brown Swiss",
                    "Brahman × Criolla",
                    "Charolais",
                    "Limousin",
                    "Simmental"), names);
            assertTrue(hasIndex(connection, "idx_razas_activo_sort"));
        }
    }

    private boolean hasIndex(Connection connection, String indexName) throws Exception {
        try (ResultSet resultSet = connection.getMetaData().getIndexInfo(null, null, "RAZAS", false, false)) {
            while (resultSet.next()) {
                if (indexName.equalsIgnoreCase(resultSet.getString("INDEX_NAME"))) {
                    return true;
                }
            }
        }
        return false;
    }

    private void applyLiquibase(Connection connection, String changeLog) throws Exception {
        Liquibase liquibase = new Liquibase(
                changeLog,
                new ClassLoaderResourceAccessor(),
                DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection)));
        liquibase.update();
    }
}

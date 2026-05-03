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

class AnimalSexLiquibaseMigrationTest {

    @Test
    void shouldAddAnimalSexColumn() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                "jdbc:h2:mem:animal-sex-migration;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "sa",
                "sa")) {
            Liquibase liquibase = new Liquibase(
                    "db/changelog/master.yaml",
                    new ClassLoaderResourceAccessor(),
                    DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection)));
            liquibase.update();

            assertTrue(columnExists(connection, "ANIMALS", "SEX"));
        }
    }

    private boolean columnExists(Connection connection, String tableName, String columnName) throws Exception {
        try (ResultSet resultSet = connection.getMetaData().getColumns(null, null, tableName, columnName)) {
            return resultSet.next();
        }
    }
}

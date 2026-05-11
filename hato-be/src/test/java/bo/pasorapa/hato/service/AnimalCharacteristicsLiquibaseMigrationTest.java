package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertTrue;

import io.agroal.api.AgroalDataSource;
import io.quarkus.test.junit.QuarkusTest;
import jakarta.inject.Inject;
import java.sql.SQLException;
import java.util.HashSet;
import java.util.Set;
import org.junit.jupiter.api.Test;

@QuarkusTest
class AnimalCharacteristicsLiquibaseMigrationTest {

    @Inject
    AgroalDataSource dataSource;

    @Test
    void shouldAddNullableAnimalCharacteristicsAndBreedForeignKey() throws SQLException {
        Set<String> columns = new HashSet<>();
        try (var connection = dataSource.getConnection();
             var resultSet = connection.getMetaData().getColumns(null, null, "ANIMALS", null)) {
            while (resultSet.next()) {
                columns.add(resultSet.getString("COLUMN_NAME"));
            }
        }

        assertTrue(columns.contains("COLOR"));
        assertTrue(columns.contains("DESCRIPTION"));
        assertTrue(columns.contains("BREED_ID"));
    }
}

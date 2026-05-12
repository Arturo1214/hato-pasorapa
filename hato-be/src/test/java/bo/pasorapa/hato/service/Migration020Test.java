package bo.pasorapa.hato.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import liquibase.Liquibase;
import liquibase.database.DatabaseFactory;
import liquibase.database.jvm.JdbcConnection;
import liquibase.resource.ClassLoaderResourceAccessor;
import org.junit.jupiter.api.Test;

class Migration020Test {

    @Test
    void shouldCopyLegacyEventRowsIntoUnifiedLogWithCorrectCategories() throws Exception {
        try (Connection connection = DriverManager.getConnection(
                "jdbc:h2:mem:animal-event-log-migration-020;MODE=PostgreSQL;DB_CLOSE_DELAY=-1",
                "sa",
                "sa")) {
            createLegacySchema(connection);
            seedLegacyRows(connection);

            applyChangelog(connection, "db/changelog/020-animal-event-log-consolidation-v1.yaml");

            assertEquals(1, countByCategory(connection, "GENERAL"));
            assertEquals(1, countByCategory(connection, "HEALTH"));
            assertEquals(1, countByCategory(connection, "REPRODUCTION"));
            assertEquals(3, countAll(connection, "animal_event_logs"));
        }
    }

    private void createLegacySchema(Connection connection) throws Exception {
        try (Statement statement = connection.createStatement()) {
            statement.execute("""
                    create table animals (
                        uuid UUID primary key
                    )
                    """);
            statement.execute("insert into animals (uuid) values ('11111111-1111-4111-8111-111111111111')");
            statement.execute("""
                    create table animal_events (
                        event_id UUID primary key,
                        animal_uuid UUID not null,
                        event_type VARCHAR(30) not null,
                        occurred_at TIMESTAMP not null,
                        client_created_at TIMESTAMP not null,
                        notes VARCHAR(500),
                        performed_by_user_id UUID not null,
                        source_channel VARCHAR(20) not null,
                        operation_id UUID not null,
                        metadata_json CLOB,
                        created_at TIMESTAMP not null,
                        updated_at TIMESTAMP not null
                    )
                    """);
            statement.execute("""
                    create table animal_health_events (
                        event_id UUID primary key,
                        animal_uuid UUID not null,
                        health_event_type VARCHAR(40) not null,
                        occurred_at TIMESTAMP not null,
                        client_created_at TIMESTAMP not null,
                        notes VARCHAR(500),
                        performed_by_user_id UUID not null,
                        source_channel VARCHAR(20) not null,
                        operation_id UUID not null,
                        metadata_json CLOB,
                        created_at TIMESTAMP not null,
                        updated_at TIMESTAMP not null
                    )
                    """);
            statement.execute("""
                    create table animal_reproduction_events (
                        event_id UUID primary key,
                        animal_uuid UUID not null,
                        reproduction_event_type VARCHAR(40) not null,
                        occurred_at TIMESTAMP not null,
                        client_created_at TIMESTAMP not null,
                        notes VARCHAR(500),
                        performed_by_user_id UUID not null,
                        source_channel VARCHAR(20) not null,
                        operation_id UUID not null,
                        metadata_json CLOB,
                        created_at TIMESTAMP not null,
                        updated_at TIMESTAMP not null
                    )
                    """);
        }
    }

    private void seedLegacyRows(Connection connection) throws Exception {
        try (Statement statement = connection.createStatement()) {
            statement.execute("""
                    insert into animal_events values (
                        '22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'TRANSFERRED',
                        timestamp '2026-05-01 08:00:00', timestamp '2026-05-01 08:01:00', 'General',
                        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'OFFLINE', '33333333-3333-4333-8333-333333333333', '{}',
                        timestamp '2026-05-01 08:02:00', timestamp '2026-05-01 08:03:00')
                    """);
            statement.execute("""
                    insert into animal_health_events values (
                        '44444444-4444-4444-8444-444444444444', '11111111-1111-4111-8111-111111111111', 'FIELD_VET_VISIT',
                        timestamp '2026-05-02 08:00:00', timestamp '2026-05-02 08:01:00', 'Health',
                        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'OFFLINE', '55555555-5555-4555-8555-555555555555', '{}',
                        timestamp '2026-05-02 08:02:00', timestamp '2026-05-02 08:03:00')
                    """);
            statement.execute("""
                    insert into animal_reproduction_events values (
                        '66666666-6666-4666-8666-666666666666', '11111111-1111-4111-8111-111111111111', 'SERVICE',
                        timestamp '2026-05-03 08:00:00', timestamp '2026-05-03 08:01:00', 'Reproduction',
                        'cccccccc-cccc-4ccc-8ccc-cccccccccccc', 'OFFLINE', '77777777-7777-4777-8777-777777777777', '{}',
                        timestamp '2026-05-03 08:02:00', timestamp '2026-05-03 08:03:00')
                    """);
        }
    }

    private void applyChangelog(Connection connection, String changelog) throws Exception {
        Liquibase liquibase = new Liquibase(
                changelog,
                new ClassLoaderResourceAccessor(),
                DatabaseFactory.getInstance().findCorrectDatabaseImplementation(new JdbcConnection(connection)));
        liquibase.update();
    }

    private int countByCategory(Connection connection, String category) throws Exception {
        try (var statement = connection.prepareStatement("select count(*) from animal_event_logs where event_category = ?")) {
            statement.setString(1, category);
            try (ResultSet resultSet = statement.executeQuery()) {
                resultSet.next();
                return resultSet.getInt(1);
            }
        }
    }

    private int countAll(Connection connection, String tableName) throws Exception {
        try (Statement statement = connection.createStatement(); ResultSet resultSet = statement.executeQuery("select count(*) from " + tableName)) {
            resultSet.next();
            return resultSet.getInt(1);
        }
    }
}

package bo.pasorapa.hato.support.sync;

import bo.pasorapa.hato.domain.Animal;
import bo.pasorapa.hato.domain.Ganadero;
import bo.pasorapa.hato.domain.Role;
import bo.pasorapa.hato.domain.User;
import bo.pasorapa.hato.domain.UserStatus;
import bo.pasorapa.hato.domain.enumeration.AnimalCategory;
import bo.pasorapa.hato.domain.enumeration.AnimalSex;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.UserRepository;
import bo.pasorapa.hato.service.dto.sync.PushSyncRequest;
import bo.pasorapa.hato.service.dto.sync.SyncEntityType;
import bo.pasorapa.hato.service.dto.sync.SyncOperationRequest;
import bo.pasorapa.hato.service.dto.sync.SyncOperationType;
import io.quarkus.narayana.jta.QuarkusTransaction;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.UUID;

public final class SyncHarnessFixtures {

    public static final UUID DEFAULT_OWNER_GANADERO_ID = UUID.fromString("6c4ab5c9-c9df-4b06-a858-ecbda97453f9");
    public static final UUID DEFAULT_ACTOR_USER_ID = UUID.fromString("ba25845f-69d4-4af0-9078-93040319401a");
    public static final int MAX_HAS_MORE_PAGES = 10;

    private final AnimalRepository animalRepository;
    private final GanaderoRepository ganaderoRepository;
    private final UserRepository userRepository;

    public SyncHarnessFixtures(AnimalRepository animalRepository, GanaderoRepository ganaderoRepository, UserRepository userRepository) {
        this.animalRepository = animalRepository;
        this.ganaderoRepository = ganaderoRepository;
        this.userRepository = userRepository;
    }

    public PushSyncRequest pushRequest(SyncOperationRequest... operations) {
        return new PushSyncRequest(List.of(operations));
    }

    public SyncOperationRequest animalUpdate(UUID operationId, UUID animalUuid, String tag, int baseVersion, String updatedAt) {
        return new SyncOperationRequest(
                operationId,
                SyncEntityType.ANIMAL,
                animalUuid.toString(),
                SyncOperationType.UPDATE,
                Map.of("tag", tag),
                baseVersion,
                OffsetDateTime.parse(updatedAt),
                OffsetDateTime.parse(updatedAt));
    }

    public SyncOperationRequest userStatusUpdate(UUID operationId, UUID userId, String status, int baseVersion, String updatedAt) {
        return new SyncOperationRequest(
                operationId,
                SyncEntityType.USER,
                userId.toString(),
                SyncOperationType.STATUS_UPDATE,
                Map.of("status", status),
                baseVersion,
                OffsetDateTime.parse(updatedAt),
                OffsetDateTime.parse(updatedAt));
    }

    public void seedAnimal(UUID uuid, String tag, long version, LocalDateTime updatedAt) {
        QuarkusTransaction.requiringNew().run(() -> {
            Animal animal = new Animal();
            animal.setCode("CODE-" + tag);
            animal.setTag(tag);
            animal.setOwnerGanadero(ganaderoRepository.findByIdOptional(DEFAULT_OWNER_GANADERO_ID).orElseThrow());
            animal.setArete(tag);
            animal.setAreteNormalized(tag.trim().toLowerCase());
            animal.setMarca("CODE-" + tag);
            animal.setMarcaNormalized(("CODE-" + tag).toLowerCase());
            animal.setUuid(uuid);
            animal.setVersion(version);
            animal.setCategory(AnimalCategory.VACA);
            animal.setSex(AnimalSex.HEMBRA);
            animal.setActive(true);
            animal.setAdmissionDate(LocalDate.of(2024, 1, 10));
            animal.setWeightKg(new BigDecimal("420.50"));
            animal.setCreatedAt(updatedAt.minusDays(1));
            animal.setUpdatedAt(updatedAt);
            animalRepository.persist(animal);
        });
    }

    public void seedAnimalPage(String prefix, int total, LocalDateTime startedAt) {
        for (int index = 0; index < total; index += 1) {
            String suffix = String.format("%03d", index + 1);
            seedAnimal(
                    stableUuid(prefix + suffix),
                    prefix + suffix,
                    index + 1L,
                    startedAt.plusMinutes(index));
        }
    }

    public void seedGanadero(UUID id, String businessIdentifier, String name, long version, LocalDateTime updatedAt) {
        QuarkusTransaction.requiringNew().run(() -> {
            Ganadero ganadero = new Ganadero();
            ganadero.setId(id);
            ganadero.setBusinessIdentifier(businessIdentifier);
            ganadero.setName(name);
            ganadero.setActive(true);
            ganaderoRepository.persist(ganadero);
            ganaderoRepository.flush();
            ganaderoRepository.getEntityManager()
                    .createNativeQuery("update ganaderos set version = ?1, created_at = ?2, updated_at = ?3 where id = ?4")
                    .setParameter(1, version)
                    .setParameter(2, updatedAt.minusDays(1))
                    .setParameter(3, updatedAt)
                    .setParameter(4, id)
                    .executeUpdate();
        });
    }

    public void seedUser(UUID id, String username, String email, Role role, UserStatus status, long version, LocalDateTime updatedAt) {
        QuarkusTransaction.requiringNew().run(() -> {
            User user = new User();
            user.setId(id);
            user.setUsername(username);
            user.setEmail(email);
            user.setDisplayName(username);
            user.setPasswordHash("hash");
            user.setRole(role);
            user.setStatus(status);
            userRepository.persist(user);
            userRepository.flush();
            userRepository.getEntityManager()
                    .createNativeQuery("update users set version = ?1, created_at = ?2, updated_at = ?3 where id = ?4")
                    .setParameter(1, version)
                    .setParameter(2, updatedAt.minusDays(2))
                    .setParameter(3, updatedAt)
                    .setParameter(4, id)
                    .executeUpdate();
        });
    }

    public record PullPageExpectation(boolean hasMore, String nextCursorId, int itemCount) {
    }

    public static UUID stableUuid(String seed) {
        return UUID.nameUUIDFromBytes(seed.getBytes(StandardCharsets.UTF_8));
    }
}

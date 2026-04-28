package bo.pasorapa.hato.support;

import bo.pasorapa.hato.repository.AnimalEventRepository;
import bo.pasorapa.hato.repository.AnimalHealthEventRepository;
import bo.pasorapa.hato.repository.AnimalRepository;
import bo.pasorapa.hato.repository.AnimalReproductionEventRepository;
import bo.pasorapa.hato.repository.AdminNotificationRepository;
import bo.pasorapa.hato.repository.GanaderoRepository;
import bo.pasorapa.hato.repository.HerdCostLedgerRepository;
import bo.pasorapa.hato.repository.HerdLotAssignmentRepository;
import bo.pasorapa.hato.repository.HerdLotRepository;
import bo.pasorapa.hato.repository.HerdProductivityLedgerRepository;
import bo.pasorapa.hato.repository.OperationLogRepository;
import bo.pasorapa.hato.repository.SyncConflictAuditLedgerRepository;
import bo.pasorapa.hato.repository.SyncOperationReceiptRepository;
import bo.pasorapa.hato.repository.UserRepository;
import jakarta.enterprise.context.ApplicationScoped;

@ApplicationScoped
public class IntegrationDatabaseCleaner {

    private final SyncOperationReceiptRepository syncOperationReceiptRepository;
    private final SyncConflictAuditLedgerRepository syncConflictAuditLedgerRepository;
    private final OperationLogRepository operationLogRepository;
    private final AnimalReproductionEventRepository animalReproductionEventRepository;
    private final AnimalHealthEventRepository animalHealthEventRepository;
    private final AnimalEventRepository animalEventRepository;
    private final HerdCostLedgerRepository herdCostLedgerRepository;
    private final HerdProductivityLedgerRepository herdProductivityLedgerRepository;
    private final HerdLotAssignmentRepository herdLotAssignmentRepository;
    private final HerdLotRepository herdLotRepository;
    private final AnimalRepository animalRepository;
    private final AdminNotificationRepository adminNotificationRepository;
    private final GanaderoRepository ganaderoRepository;
    private final UserRepository userRepository;

    public IntegrationDatabaseCleaner(
            SyncOperationReceiptRepository syncOperationReceiptRepository,
            SyncConflictAuditLedgerRepository syncConflictAuditLedgerRepository,
            OperationLogRepository operationLogRepository,
            AnimalReproductionEventRepository animalReproductionEventRepository,
            AnimalHealthEventRepository animalHealthEventRepository,
            AnimalEventRepository animalEventRepository,
            HerdCostLedgerRepository herdCostLedgerRepository,
            HerdProductivityLedgerRepository herdProductivityLedgerRepository,
            HerdLotAssignmentRepository herdLotAssignmentRepository,
            HerdLotRepository herdLotRepository,
            AnimalRepository animalRepository,
            AdminNotificationRepository adminNotificationRepository,
            GanaderoRepository ganaderoRepository,
            UserRepository userRepository) {
        this.syncOperationReceiptRepository = syncOperationReceiptRepository;
        this.syncConflictAuditLedgerRepository = syncConflictAuditLedgerRepository;
        this.operationLogRepository = operationLogRepository;
        this.animalReproductionEventRepository = animalReproductionEventRepository;
        this.animalHealthEventRepository = animalHealthEventRepository;
        this.animalEventRepository = animalEventRepository;
        this.herdCostLedgerRepository = herdCostLedgerRepository;
        this.herdProductivityLedgerRepository = herdProductivityLedgerRepository;
        this.herdLotAssignmentRepository = herdLotAssignmentRepository;
        this.herdLotRepository = herdLotRepository;
        this.animalRepository = animalRepository;
        this.adminNotificationRepository = adminNotificationRepository;
        this.ganaderoRepository = ganaderoRepository;
        this.userRepository = userRepository;
    }

    public void clean() {
        syncConflictAuditLedgerRepository.deleteAll();
        syncOperationReceiptRepository.deleteAll();
        operationLogRepository.deleteAll();
        animalReproductionEventRepository.deleteAll();
        animalHealthEventRepository.deleteAll();
        animalEventRepository.deleteAll();
        herdCostLedgerRepository.deleteAll();
        herdProductivityLedgerRepository.deleteAll();
        herdLotAssignmentRepository.deleteAll();
        herdLotRepository.deleteAll();
        animalRepository.deleteAll();
        adminNotificationRepository.getEntityManager().createQuery("delete from AdminNotificationRecipient").executeUpdate();
        adminNotificationRepository.deleteAll();
        ganaderoRepository.deleteAll();
        userRepository.deleteAll();
    }
}

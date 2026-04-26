import { ApplicationConfigService } from './core/config/application-config.service';
import { SyncOrchestratorService } from './core/offline/sync-orchestrator.service';

export function initializeApplicationRuntime(
  configService: Pick<ApplicationConfigService, 'bootstrap'>,
  syncOrchestrator: Pick<SyncOrchestratorService, 'initialize'>
) {
  return async () => {
    configService.bootstrap();
    await syncOrchestrator.initialize();
  };
}

import { ApplicationConfigService } from './core/config/application-config.service';
import { AuthService } from './core/auth/data-access/auth.service';
import { SyncOrchestratorService } from './core/offline/sync-orchestrator.service';
import { AdminReportingStore } from './features/admin/reporting/data-access/admin-reporting.store';
import { CalendarAlertsStore } from './features/admin/calendar/data-access/calendar-alerts.store';
import { AdminConflictResolutionStore } from './features/admin/conflicts/data-access/admin-conflict-resolution.store';
import { NotificationInboxStore } from './features/admin/notifications/data-access/notification-inbox.store';

let offlineRestoreRehydrationHandler: (() => Promise<void>) | null = null;

export function registerOfflineRestoreRehydration(handler: () => Promise<void>) {
  offlineRestoreRehydrationHandler = handler;
}

export async function runOfflineRestoreRehydration() {
  await offlineRestoreRehydrationHandler?.();
}

export function initializeApplicationRuntime(
  configService: Pick<ApplicationConfigService, 'bootstrap'>,
  authService: Pick<AuthService, 'refreshOfflineSession'>,
  syncOrchestrator: Pick<SyncOrchestratorService, 'initialize'>,
  calendarAlertsStore: Pick<CalendarAlertsStore, 'initialize' | 'rebuild'>,
  conflictResolutionStore: Pick<AdminConflictResolutionStore, 'initialize' | 'rebuild'>,
  notificationInboxStore: Pick<NotificationInboxStore, 'initialize' | 'rebuild'>,
  adminReportingStore: Pick<AdminReportingStore, 'initialize' | 'rebuild'>
) {
  return async () => {
    registerOfflineRestoreRehydration(async () => {
      await calendarAlertsStore.rebuild('manual');
      await notificationInboxStore.rebuild('manual');
      await adminReportingStore.rebuild('manual');
      await conflictResolutionStore.rebuild('manual');
    });
    configService.bootstrap();
    authService.refreshOfflineSession();
    await syncOrchestrator.initialize();
    await calendarAlertsStore.initialize();
    await conflictResolutionStore.initialize();
    await notificationInboxStore.initialize();
    await adminReportingStore.initialize();
  };
}

import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MAT_ICON_DEFAULT_OPTIONS } from '@angular/material/icon';
import { provideRouter, withViewTransitions } from '@angular/router';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { provideServiceWorker } from '@angular/service-worker';
import { initializeApplicationRuntime } from './app.initializers';
import { AuthService } from './core/auth/data-access/auth.service';
import { routes } from './app.routes';
import { ApplicationConfigService } from './core/config/application-config.service';
import {
  HATO_SERVICE_WORKER_SCRIPT,
  createServiceWorkerRegistrationOptions,
} from './core/offline/pwa-shell';
import { SyncOrchestratorService } from './core/offline/sync-orchestrator.service';
import { CalendarAlertsStore } from './features/admin/calendar/data-access/calendar-alerts.store';
import { AdminConflictResolutionStore } from './features/admin/conflicts/data-access/admin-conflict-resolution.store';
import { AdminReportingStore } from './features/admin/reporting/data-access/admin-reporting.store';
import { ensureChartJsRegistered } from './shared/ui/charts/chart-js-setup';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideAnimationsAsync(),
    provideNativeDateAdapter(),
    provideRouter(routes, withViewTransitions()),
    provideHttpClient(withFetch()),
    provideServiceWorker(
      HATO_SERVICE_WORKER_SCRIPT,
      createServiceWorkerRegistrationOptions(isDevMode())
    ),
    {
      provide: MAT_ICON_DEFAULT_OPTIONS,
      useValue: { fontSet: 'material-symbols-outlined' },
    },
    {
      provide: SyncOrchestratorService,
      useFactory: () => new SyncOrchestratorService(),
    },
    provideAppInitializer(() => {
      ensureChartJsRegistered();
    }),
    provideAppInitializer(() => {
      return initializeApplicationRuntime(
        inject(ApplicationConfigService),
        inject(AuthService),
        inject(SyncOrchestratorService),
        inject(CalendarAlertsStore),
        inject(AdminConflictResolutionStore),
        inject(AdminReportingStore)
      )();
    }),
  ],
};

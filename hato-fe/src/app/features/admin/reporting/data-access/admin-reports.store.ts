import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom, type Observable } from 'rxjs';
import {
  AdminReportsService,
  type AdminReportFilters,
  type AdminReportId,
  type AdminReportRow,
  type HealthActivityFilter,
  type HealthActivityResponse,
  type InventoryByGanaderoFilter,
  type InventoryByGanaderoResponse,
  type NotificationReachFilter,
  type NotificationReachResponse,
} from './admin-reports.service';

const DEFAULT_REPORT: AdminReportId = 'inventory-by-ganadero';

@Injectable({ providedIn: 'root' })
export class AdminReportsStore {
  private readonly service = inject(AdminReportsService);

  private readonly selectedReportState = signal<AdminReportId>(DEFAULT_REPORT);
  private readonly filtersState = signal<AdminReportFilters>({});
  private readonly reportDataState = signal<AdminReportRow[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);

  readonly selectedReport = this.selectedReportState.asReadonly();
  readonly filters = this.filtersState.asReadonly();
  readonly reportData = this.reportDataState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly canExport = computed(() => !this.loadingState() && !this.errorState() && this.reportDataState().length > 0);

  setFilter(filter: Partial<AdminReportFilters>) {
    this.filtersState.update((current) => ({ ...current, ...filter }));
  }

  async loadReport(report: AdminReportId = this.selectedReportState(), filter: AdminReportFilters = this.filtersState()) {
    this.selectedReportState.set(report);
    this.filtersState.set(filter);
    this.loadingState.set(true);
    this.errorState.set(null);

    try {
      const response = await firstValueFrom(this.dispatchReportRequest(report, filter));
      this.reportDataState.set(response.rows);
    } catch (error) {
      this.reportDataState.set([]);
      this.errorState.set(error instanceof Error ? error.message : 'No pudimos cargar el reporte administrativo.');
    } finally {
      this.loadingState.set(false);
    }
  }

  private dispatchReportRequest(
    report: AdminReportId,
    filter: AdminReportFilters
  ): Observable<InventoryByGanaderoResponse | HealthActivityResponse | NotificationReachResponse> {
    if (report === 'health-activity') {
      return this.service.getHealthActivity(filter as HealthActivityFilter);
    }

    if (report === 'notification-reach') {
      return this.service.getNotificationReach(filter as NotificationReachFilter);
    }

    return this.service.getInventoryByGanadero(filter as InventoryByGanaderoFilter);
  }
}

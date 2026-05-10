import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import {
  DataTableComponent,
  DATA_TABLE_FILTER_TYPE,
  type DataTableColumn,
  type DataTableRow,
} from '../../../shared/ui/data-table/data-table.component';
import { AdminReportsExportService } from './data-access/admin-reports-export';
import { type AdminReportFilters, type AdminReportId, type AdminReportRow } from './data-access/admin-reports.service';
import { AdminReportsStore } from './data-access/admin-reports.store';

interface ReportDefinition {
  description: string;
  exportName: string;
  id: AdminReportId;
  label: string;
}

@Component({
  selector: 'app-admin-reporting-page',
  standalone: true,
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSelectModule,
    DataTableComponent,
  ],
  providers: [provideNativeDateAdapter()],
  template: `
    <section class="reporting-page">
      <mat-card appearance="outlined" class="toolbar-card">
        <div class="report-selector" aria-label="Reportes disponibles">
          @for (report of reports; track report.id) {
            <button
              mat-stroked-button
              type="button"
              [class.is-active]="selectedReport() === report.id"
              [attr.aria-pressed]="selectedReport() === report.id"
              (click)="selectReport(report.id)"
            >
              {{ report.label }}
            </button>
          }
        </div>

        <button
          mat-flat-button
          color="primary"
          data-testid="export-report"
          type="button"
          [disabled]="exportDisabled()"
          (click)="exportCurrentReport()"
        >
          <mat-icon>download</mat-icon>
          Exportar Excel
        </button>
      </mat-card>

      <mat-card appearance="outlined" class="status-card">
        <strong>{{ selectedDefinition().label }}</strong>
        <p>{{ selectedDefinition().description }}</p>
      </mat-card>

      @if (loading()) {
        <mat-card appearance="outlined" role="status" aria-live="polite"><p>Cargando reporte administrativo…</p></mat-card>
      }

      @if (error()) {
        <mat-card appearance="outlined" role="alert" aria-live="assertive"><p>{{ error() }}</p></mat-card>
      }

      <mat-card appearance="outlined" class="filters-card">
        <div class="filters-card__heading">
          <mat-icon>tune</mat-icon>
          <span>Filtros</span>
        </div>

        <div class="filters-row">
          @if (selectedReport() === 'inventory-by-ganadero') {
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filter-control filter-control--sm">
              <mat-label>Ganadero</mat-label>
              <input matInput type="number" [value]="filters().ganaderoId ?? ''" (input)="updateNumberFilter('ganaderoId', $any($event.target).value)" />
            </mat-form-field>

            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filter-control filter-control--sm">
              <mat-label>Estado</mat-label>
              <mat-select [value]="activeFilterValue()" (valueChange)="updateActiveFilter($event)">
                <mat-option value="">Todos</mat-option>
                <mat-option value="true">Activos</mat-option>
                <mat-option value="false">Inactivos</mat-option>
              </mat-select>
            </mat-form-field>
          } @else {
            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filter-control filter-control--date">
              <mat-label>Desde</mat-label>
              <input
                matInput
                [matDatepicker]="fromPicker"
                [value]="dateFilterValue('from')"
                (dateChange)="updateDateFilter('from', $event.value)"
                (input)="updateTextFilter('from', $any($event.target).value)"
              />
              <mat-datepicker-toggle matIconSuffix [for]="fromPicker" />
              <mat-datepicker #fromPicker />
            </mat-form-field>

            <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filter-control filter-control--date">
              <mat-label>Hasta</mat-label>
              <input
                matInput
                [matDatepicker]="toPicker"
                [value]="dateFilterValue('to')"
                (dateChange)="updateDateFilter('to', $event.value)"
                (input)="updateTextFilter('to', $any($event.target).value)"
              />
              <mat-datepicker-toggle matIconSuffix [for]="toPicker" />
              <mat-datepicker #toPicker />
            </mat-form-field>

            @if (selectedReport() === 'health-activity') {
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filter-control">
                <mat-label>Tipo de evento</mat-label>
                <mat-select [value]="filters().type ?? ''" (valueChange)="updateTextFilter('type', $event)">
                  <mat-option value="">Todos</mat-option>
                  @for (option of healthEventTypeOptions; track option.value) {
                    <mat-option [value]="option.value">{{ option.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filter-control filter-control--sm">
                <mat-label>Ganadero</mat-label>
                <input matInput type="number" [value]="filters().ganaderoId ?? ''" (input)="updateNumberFilter('ganaderoId', $any($event.target).value)" />
              </mat-form-field>

              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filter-control">
                <mat-label>Animal</mat-label>
                <input matInput [value]="filters().animalUuid ?? ''" (input)="updateTextFilter('animalUuid', $any($event.target).value)" />
              </mat-form-field>
            }

            @if (selectedReport() === 'notification-reach') {
              <mat-form-field appearance="outline" subscriptSizing="dynamic" class="filter-control">
                <mat-label>Segmentación</mat-label>
                <mat-select [value]="filters().targetingMode ?? ''" (valueChange)="updateTextFilter('targetingMode', $event)">
                  <mat-option value="">Todas</mat-option>
                  <mat-option value="ALL_ACTIVE_GANADEROS">Todos los ganaderos activos</mat-option>
                  <mat-option value="EXPLICIT_LIST">Lista explícita</mat-option>
                </mat-select>
              </mat-form-field>
            }
          }
        </div>

        <button mat-stroked-button type="button" [disabled]="loading()" (click)="applyFilters()">
          <mat-icon>search</mat-icon>
          Aplicar
        </button>
      </mat-card>

      @if (filterValidationMessage()) {
        <mat-card appearance="outlined" role="alert" aria-live="assertive" class="validation-card">
          <p>{{ filterValidationMessage() }}</p>
        </mat-card>
      }

      @if (summaryCards().length) {
        <section class="kpi-grid" aria-label="Resumen del reporte">
          @for (kpi of summaryCards(); track kpi.label) {
            <mat-card appearance="outlined" class="kpi-card">
              <span>{{ kpi.label }}</span>
              <strong>{{ kpi.value }}</strong>
            </mat-card>
          }
        </section>
      }

      <mat-card appearance="outlined" class="table-card">
        <app-data-table
          [columns]="selectedColumns()"
          [data]="tableRows()"
          [loading]="loading()"
          emptyMessage="No hay datos para los filtros seleccionados"
        />
      </mat-card>
    </section>
  `,
  styles: [
    `
      .reporting-page {
        display: grid;
        gap: 1rem;
        padding: 1rem;
      }

      .toolbar-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .filters-card {
        display: grid;
        grid-template-columns: auto minmax(0, 1fr) auto;
        align-items: center;
        gap: 0.75rem;
        padding: 0.75rem 1rem;
      }

      .report-selector {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }

      .report-selector button,
      .toolbar-card > button,
      .filters-card > button {
        border-radius: 999px;
      }

      .filters-card > button mat-icon {
        margin-inline-end: 0.35rem;
      }

      .filters-card__heading {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.9rem;
        font-weight: 700;
        white-space: nowrap;
      }

      .filters-card__heading mat-icon {
        font-size: 1.1rem;
        width: 1.1rem;
        height: 1.1rem;
      }

      .filters-row {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        min-width: 0;
        overflow-x: auto;
        padding-block: 0.15rem;
      }

      .report-selector .is-active {
        border-color: var(--mat-sys-primary);
        color: var(--mat-sys-primary);
      }

      .status-card {
        display: grid;
        gap: 0.25rem;
      }

      .status-card p,
      .validation-card p {
        margin: 0;
        color: var(--mat-sys-on-surface-variant);
      }

      .validation-card {
        border-color: var(--mat-sys-error);
      }

      .validation-card p {
        color: var(--mat-sys-error);
      }

      .filter-control {
        flex: 0 0 13rem;
        width: 13rem;
      }

      .filter-control--date {
        flex-basis: 10.5rem;
        width: 10.5rem;
      }

      .filter-control--sm {
        flex-basis: 9rem;
        width: 9rem;
      }

      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
        gap: 1rem;
      }

      .kpi-card {
        display: grid;
        gap: 0.35rem;
      }

      .kpi-card span {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.85rem;
      }

      .kpi-card strong {
        font-size: 1.6rem;
      }

      .table-card {
        display: grid;
        gap: 0.75rem;
        padding: 0.75rem;
      }

      @media (max-width: 760px) {
        .filters-card {
          grid-template-columns: 1fr;
        }

        .filters-row {
          align-items: stretch;
          flex-wrap: wrap;
          overflow-x: visible;
        }

        .filter-control,
        .filter-control--date,
        .filter-control--sm {
          flex: 1 1 12rem;
          width: auto;
        }

        .filters-card > button {
          justify-self: end;
        }
      }
    `,
  ],
})
export class AdminReportingPageComponent {
  readonly store = inject(AdminReportsStore);
  private readonly exportService = inject(AdminReportsExportService);
  readonly selectedReport = this.store.selectedReport;
  readonly filters = this.store.filters;
  readonly reportData = this.store.reportData;
  readonly loading = this.store.loading;
  readonly error = this.store.error;

  readonly reports: readonly ReportDefinition[] = [
    {
      id: 'inventory-by-ganadero',
      label: 'Inventario por Ganadero',
      exportName: 'InventarioPorGanadero',
      description: 'Conteos de animales agrupados por ganadero, categoría, sexo y estado.',
    },
    {
      id: 'health-activity',
      label: 'Actividad Sanitaria',
      exportName: 'ActividadSanitaria',
      description: 'Eventos sanitarios y veterinarios filtrados por fecha, tipo, ganadero o animal.',
    },
    {
      id: 'notification-reach',
      label: 'Alcance de Notificaciones',
      exportName: 'AlcanceNotificaciones',
      description: 'Resumen de destinatarios, lecturas, pendientes y tasa de lectura por notificación.',
    },
  ];
  readonly healthEventTypeOptions = [
    { value: 'VACCINATION', label: 'Vacunación' },
    { value: 'DEWORMING', label: 'Desparasitación' },
    { value: 'DISEASE_REPORTED', label: 'Enfermedad reportada' },
    { value: 'TREATMENT_STARTED', label: 'Tratamiento iniciado' },
    { value: 'TREATMENT_FOLLOW_UP', label: 'Seguimiento de tratamiento' },
    { value: 'TREATMENT_CLOSED', label: 'Tratamiento cerrado' },
    { value: 'FIELD_VET_VISIT', label: 'Visita veterinaria de campo' },
  ] as const;

  readonly inventoryColumns: readonly DataTableColumn[] = [
    { key: 'ganaderoName', label: 'Ganadero', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.TEXT },
    { key: 'total', label: 'Total', sortable: true },
    { key: 'active', label: 'Activos', sortable: true },
    { key: 'inactive', label: 'Inactivos', sortable: true },
    { key: 'byCategory', label: 'Por categoría', formatter: formatBreakdown },
    { key: 'bySex', label: 'Por sexo', formatter: formatBreakdown },
  ];

  readonly healthColumns: readonly DataTableColumn[] = [
    { key: 'occurredAt', label: 'Fecha', sortable: true, formatter: formatDateTime },
    { key: 'type', label: 'Tipo', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.TEXT },
    { key: 'ganaderoName', label: 'Ganadero', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.TEXT },
    { key: 'animalCode', label: 'Animal', sortable: true, formatter: formatAnimal },
    { key: 'notes', label: 'Notas', formatter: formatNullable },
  ];

  readonly notificationColumns: readonly DataTableColumn[] = [
    { key: 'title', label: 'Notificación', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.TEXT },
    { key: 'publishedAt', label: 'Publicada', sortable: true, formatter: formatDateTime },
    { key: 'targetingMode', label: 'Segmentación', sortable: true, formatter: formatTargetingMode },
    { key: 'totalRecipients', label: 'Destinatarios', sortable: true },
    { key: 'readCount', label: 'Leídos', sortable: true },
    { key: 'pendingCount', label: 'Pendientes', sortable: true },
    { key: 'readRate', label: 'Tasa lectura', sortable: true, formatter: (value) => `${value ?? 0}%` },
  ];

  readonly selectedDefinition = computed(() => this.reports.find((report) => report.id === this.selectedReport()) ?? this.reports[0]);
  readonly selectedColumns = computed(() => {
    if (this.selectedReport() === 'health-activity') {
      return this.healthColumns;
    }

    if (this.selectedReport() === 'notification-reach') {
      return this.notificationColumns;
    }

    return this.inventoryColumns;
  });
  readonly tableRows = computed(() => this.reportData() as DataTableRow[]);
  readonly filterValidationMessage = computed(() => validateDateRange(this.filters()));
  readonly exportDisabled = computed(() => this.loading() || !!this.error() || !!this.filterValidationMessage() || this.reportData().length === 0);
  readonly summaryCards = computed(() => buildSummaryCards(this.selectedReport(), this.reportData()));

  constructor() {
    void this.store.loadReport(this.selectedReport(), this.defaultFiltersFor(this.selectedReport()));
  }

  async selectReport(report: AdminReportId) {
    await this.store.loadReport(report, this.defaultFiltersFor(report));
  }

  updateTextFilter(key: keyof AdminReportFilters, value: string) {
    this.store.setFilter({ [key]: value || null });
  }

  updateDateFilter(key: 'from' | 'to', value: Date | null) {
    this.store.setFilter({ [key]: value ? formatDateInput(value) : null });
  }

  updateNumberFilter(key: keyof AdminReportFilters, value: string) {
    this.store.setFilter({ [key]: value === '' ? null : Number(value) });
  }

  updateActiveFilter(value: string) {
    this.store.setFilter({ active: value === '' ? null : value === 'true' });
  }

  activeFilterValue() {
    const active = this.filters().active;
    return active === null || active === undefined ? '' : String(active);
  }

  dateFilterValue(key: 'from' | 'to') {
    const value = this.filters()[key];
    return value ? new Date(`${value}T00:00:00`) : null;
  }

  async applyFilters() {
    if (this.filterValidationMessage()) {
      return;
    }

    await this.store.loadReport(this.selectedReport(), this.filters());
  }

  async exportCurrentReport() {
    if (this.exportDisabled()) {
      return;
    }

    await this.exportService.exportToExcel(this.tableRows(), this.selectedColumns(), this.selectedDefinition().exportName);
  }

  private defaultFiltersFor(report: AdminReportId): AdminReportFilters {
    if (report === 'inventory-by-ganadero') {
      return {};
    }

    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), 1);
    return { from: formatDateInput(from), to: formatDateInput(today), limit: 200 };
  }
}

function validateDateRange(filters: AdminReportFilters) {
  if (!filters.from || !filters.to) {
    return null;
  }

  const from = new Date(`${filters.from}T00:00:00`);
  const to = new Date(`${filters.to}T00:00:00`);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return 'Revisá el formato de fechas antes de aplicar el filtro.';
  }

  return to >= from ? null : 'La fecha "Hasta" debe ser mayor o igual a "Desde".';
}

function buildSummaryCards(report: AdminReportId, rows: readonly AdminReportRow[]) {
  if (!rows.length) {
    return [];
  }

  if (report === 'inventory-by-ganadero') {
    const totals = rows.reduce(
      (accumulator, row) => {
        const inventoryRow = row as { total: number; active: number; inactive: number };
        return {
          total: accumulator.total + inventoryRow.total,
          active: accumulator.active + inventoryRow.active,
          inactive: accumulator.inactive + inventoryRow.inactive,
        };
      },
      { total: 0, active: 0, inactive: 0 }
    );

    return [
      { label: 'Animales totales', value: totals.total },
      { label: 'Activos', value: totals.active },
      { label: 'Inactivos', value: totals.inactive },
    ];
  }

  if (report === 'notification-reach') {
    const totals = rows.reduce(
      (accumulator, row) => {
        const notificationRow = row as { totalRecipients: number; readCount: number; pendingCount: number };
        return {
          totalRecipients: accumulator.totalRecipients + notificationRow.totalRecipients,
          readCount: accumulator.readCount + notificationRow.readCount,
          pendingCount: accumulator.pendingCount + notificationRow.pendingCount,
        };
      },
      { totalRecipients: 0, readCount: 0, pendingCount: 0 }
    );

    return [
      { label: 'Destinatarios', value: totals.totalRecipients },
      { label: 'Leídos', value: totals.readCount },
      { label: 'Pendientes', value: totals.pendingCount },
    ];
  }

  return [{ label: 'Eventos encontrados', value: rows.length }];
}

function formatBreakdown(value: unknown) {
  const entries = Object.entries((value ?? {}) as Record<string, number>);
  return entries.length
    ? entries
        .filter(([, count]) => count > 0)
        .map(([key, count]) => `${humanizeBreakdownKey(key)} (${count})`)
        .join(' · ') || '—'
    : '—';
}

function formatDateTime(value: unknown) {
  if (!value) {
    return '—';
  }

  return new Intl.DateTimeFormat('es-BO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(String(value)));
}

function formatNullable(value: unknown) {
  return value ? String(value) : '—';
}

function formatAnimal(value: unknown, row: DataTableRow) {
  const record = row as Record<string, unknown>;
  return String(value ?? record['animalTag'] ?? record['animalUuid'] ?? '—');
}

function formatTargetingMode(value: unknown) {
  if (value === 'ALL_ACTIVE_GANADEROS') {
    return 'Todos los ganaderos activos';
  }

  if (value === 'EXPLICIT_LIST') {
    return 'Lista explícita';
  }

  return formatNullable(value);
}

function humanizeBreakdownKey(key: string) {
  const labels: Record<string, string> = {
    BUEY: 'Bueyes',
    HEMBRA: 'Hembras',
    MACHO: 'Machos',
    TERNERA: 'Terneras',
    TERNERO: 'Terneros',
    TORO: 'Toros',
    VACA: 'Vacas',
    VAQUILLONA: 'Vaquillonas',
  };

  return labels[key] ?? key.toLowerCase().replace(/_/g, ' ');
}

function formatDateInput(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

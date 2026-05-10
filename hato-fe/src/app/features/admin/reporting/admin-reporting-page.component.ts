import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import {
  DataTableComponent,
  DATA_TABLE_FILTER_TYPE,
  type DataTableColumn,
  type DataTableRow,
} from '../../../shared/ui/data-table/data-table.component';
import { AdminReportingStore } from './data-access/admin-reporting.store';

@Component({
  selector: 'app-admin-reporting-page',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, DataTableComponent],
  template: `
    <section class="reporting-page">
      <mat-card appearance="outlined" class="status-card">
        <div>
          <p><strong>Última sync:</strong> {{ freshness().lastSyncAt ?? 'Sin sync previa' }}</p>
          <p><strong>Último cálculo:</strong> {{ freshness().lastComputedAt ?? 'Todavía no calculado' }}</p>
          <p><strong>Estado:</strong> {{ stale() ? 'requiere recalcular' : 'actualizado' }}</p>
        </div>
        <button mat-flat-button color="primary" type="button" [disabled]="loading()" (click)="refresh()">
          <mat-icon>refresh</mat-icon>
          {{ loading() ? 'Actualizando…' : 'Refrescar ahora' }}
        </button>
      </mat-card>

      @if (statusMessage()) {
        <mat-card appearance="outlined" role="status" aria-live="polite"><p>{{ statusMessage() }}</p></mat-card>
      }

      @if (error()) {
        <mat-card appearance="outlined" role="alert" aria-live="assertive"><p>{{ error() }}</p></mat-card>
      }

      <mat-card appearance="outlined" class="controls-card">
        <div>
          <strong>Ventana activa: {{ selectedWindow() }}</strong>
          <div class="controls-row">
            @for (window of windows(); track window) {
              <button mat-stroked-button type="button" [attr.data-window]="window" [class.is-active]="window === selectedWindow()" (click)="useWindow(window)">
                {{ window }}
              </button>
            }
          </div>
        </div>
        <div>
          <strong>Preset activo: {{ selectedPreset() }}</strong>
          <div class="controls-row">
            @for (preset of presets(); track preset) {
              <button mat-stroked-button type="button" [attr.data-preset]="preset" [class.is-active]="preset === selectedPreset()" (click)="usePreset(preset)">
                {{ preset }}
              </button>
            }
          </div>
        </div>
        <p>{{ scopeGuardMessage() }}</p>
      </mat-card>

      <section class="kpi-grid" aria-label="Resumen administrativo">
        @for (kpi of summaryCards(); track kpi.label) {
          <mat-card appearance="outlined" class="kpi-card">
            <span>{{ kpi.label }}</span>
            <strong>{{ kpi.value }}</strong>
          </mat-card>
        }
      </section>

      <section class="kpi-grid" aria-label="KPIs descriptivos">
        @for (kpi of descriptiveCards(); track kpi.label) {
          <mat-card appearance="outlined" class="kpi-card kpi-card--accent">
            <span>{{ kpi.label }}</span>
            <strong>{{ kpi.value }}</strong>
          </mat-card>
        }
      </section>

      <mat-card appearance="outlined" class="table-card">
        <h2>Conteos por tipo ({{ selectedWindow() }})</h2>
        <app-data-table
          [columns]="eventCountColumns"
          [data]="eventCountRows()"
          [loading]="loading()"
          emptyMessage="No hay eventos para esta ventana."
        />
      </mat-card>

      <mat-card appearance="outlined" class="table-card">
        <h2>Actividad reciente</h2>
        <app-data-table
          [columns]="recentActivityColumns"
          [data]="recentActivityRows()"
          [filters]="recentActivityFilters()"
          [loading]="loading()"
          emptyMessage="No hay actividad reciente visible."
          (filterChange)="recentActivityFilters.set($event)"
        />
      </mat-card>

      <mat-card appearance="outlined" class="table-card">
        <h2>Desglose por lote</h2>
        <app-data-table
          [columns]="lotBreakdownColumns"
          [data]="lotBreakdownRows()"
          [filters]="lotBreakdownFilters()"
          [loading]="loading()"
          emptyMessage="No hay lotes visibles para esta ventana."
          (filterChange)="lotBreakdownFilters.set($event)"
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

      .status-card,
      .controls-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
        flex-wrap: wrap;
      }

      .status-card p,
      .controls-card p {
        margin: 0.25rem 0;
      }

      .status-card button,
      .controls-row button {
        border-radius: 999px;
      }

      .status-card mat-icon {
        margin-inline-end: 0.35rem;
      }

      .controls-row {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        margin-top: 0.5rem;
      }

      .controls-row .is-active {
        border-color: var(--mat-sys-primary);
        color: var(--mat-sys-primary);
      }

      .kpi-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
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
        font-size: 1.75rem;
      }

      .kpi-card--accent {
        border-color: color-mix(in srgb, var(--mat-sys-primary) 35%, var(--mat-sys-outline-variant));
      }

      .table-card {
        display: grid;
        gap: 0.75rem;
        padding: 0.75rem;
      }

      .table-card h2 {
        margin: 0;
        font-size: 1rem;
      }
    `,
  ],
})
export class AdminReportingPageComponent {
  readonly store = inject(AdminReportingStore);
  readonly summary = this.store.summary;
  readonly freshness = this.store.freshness;
  readonly stale = this.store.stale;
  readonly error = this.store.error;
  readonly loading = this.store.loading;
  readonly statusMessage = this.store.statusMessage;
  readonly selectedWindow = this.store.selectedWindow;
  readonly selectedPreset = this.store.selectedPreset;
  readonly recentActivity = this.store.recentActivity;
  readonly descriptiveKpis = this.store.descriptiveKpis;
  readonly lotBreakdown = this.store.lotBreakdown;
  readonly windows = this.store.allowedWindows;
  readonly presets = this.store.allowedPresets;
  readonly scopeGuardMessage = this.store.scopeGuardMessage;
  readonly recentActivityFilters = signal<Record<string, string>>({});
  readonly lotBreakdownFilters = signal<Record<string, string>>({});
  readonly eventCountEntries = computed(() =>
    Object.entries(this.store.eventCounts())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([key, value]) => ({ key, value }))
  );
  readonly eventCountRows = computed(() => this.eventCountEntries() as unknown as DataTableRow[]);
  readonly recentActivityRows = computed(() => this.recentActivity() as unknown as DataTableRow[]);
  readonly lotBreakdownRows = computed(() => this.lotBreakdown() as unknown as DataTableRow[]);
  readonly summaryCards = computed(() => [
    { label: 'Usuarios', value: this.summary().usersTotal },
    { label: 'Ganaderos', value: this.summary().ganaderosTotal },
    { label: 'Animales', value: this.summary().animalesTotal },
    { label: 'Animales activos', value: this.summary().animalesActivos },
    { label: 'Lotes', value: this.summary().lotesTotal },
    { label: 'Lotes activos', value: this.summary().lotesActivos },
    { label: 'Asignaciones activas', value: this.summary().asignacionesActivas },
    { label: 'Costo acumulado', value: this.summary().costoAcumulado },
  ]);
  readonly descriptiveCards = computed(() => [
    { label: `Animales activos con lote (${this.selectedWindow()})`, value: this.descriptiveKpis().animalesActivos },
    { label: `Lotes activos (${this.selectedWindow()})`, value: this.descriptiveKpis().lotesActivos },
    { label: 'Entradas productividad', value: this.descriptiveKpis().productividadTotal },
    { label: 'Entradas costos', value: this.descriptiveKpis().costosTotal },
    { label: 'Costo acumulado', value: this.descriptiveKpis().costoAcumulado },
  ]);

  readonly eventCountColumns: DataTableColumn[] = [
    { key: 'key', label: 'Tipo', sortable: true },
    { key: 'value', label: 'Eventos', sortable: true },
  ];
  readonly recentActivityColumns: DataTableColumn[] = [
    { key: 'title', label: 'Evento', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.TEXT },
    { key: 'animalLabel', label: 'Animal', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.TEXT },
    { key: 'occurredAt', label: 'Fecha', sortable: true },
  ];
  readonly lotBreakdownColumns: DataTableColumn[] = [
    { key: 'lotName', label: 'Lote', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.TEXT },
    { key: 'animalesActivos', label: 'Animales activos', sortable: true },
    { key: 'productividadTotal', label: 'Productividad', sortable: true },
    { key: 'costosTotal', label: 'Costos', sortable: true },
    { key: 'costoAcumulado', label: 'Costo acumulado', sortable: true },
  ];

  constructor() {
    void this.store.ensureFresh();
  }

  async useWindow(window: '7d' | '30d' | '90d') {
    await this.store.setWindow(window);
  }

  async usePreset(preset: 'all' | 'active_only' | 'inactive_only') {
    await this.store.setPreset(preset);
  }

  async refresh() {
    await this.store.refreshNow();
  }
}

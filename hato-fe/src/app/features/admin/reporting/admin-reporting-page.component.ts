import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { AdminReportingStore } from './data-access/admin-reporting.store';

@Component({
  selector: 'app-admin-reporting-page',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule],
  template: `
    <section class="reporting-page">
      <header class="page-header">
        <h1>Reportes administrativos</h1>
        <p>Vista descriptiva offline-first con métricas agregadas, lotes, costos, productividad y frescura visible.</p>
      </header>

      <mat-card appearance="outlined">
        <h2>Frescura</h2>
        <p>Última sync: {{ freshness().lastSyncAt ?? 'Sin sync previa' }}</p>
        <p>Último cálculo: {{ freshness().lastComputedAt ?? 'Todavía no calculado' }}</p>
        <p>{{ stale() ? 'Estado: stale' : 'Estado: current' }}</p>
        @if (statusMessage()) {
          <p>{{ statusMessage() }}</p>
        }
        @if (error()) {
          <p>{{ error() }}</p>
        }
        <button mat-stroked-button type="button" (click)="refresh()">Refrescar ahora</button>
      </mat-card>

      <mat-card appearance="outlined">
        <h2>Controles V2</h2>
        <div class="controls-row">
          @for (window of windows(); track window) {
            <button mat-button type="button" [attr.data-window]="window" (click)="useWindow(window)">
              {{ window }}
            </button>
          }
        </div>
        <div class="controls-row">
          @for (preset of presets(); track preset) {
            <button mat-button type="button" [attr.data-preset]="preset" (click)="usePreset(preset)">
              {{ preset }}
            </button>
          }
        </div>
        <p>Ventana activa: {{ selectedWindow() }}</p>
        <p>Preset activo: {{ selectedPreset() }}</p>
        <p>{{ scopeGuardMessage() }}</p>
      </mat-card>

      <mat-card appearance="outlined">
        <h2>Resumen</h2>
        <p>Usuarios: {{ summary().usersTotal }}</p>
        <p>Ganaderos: {{ summary().ganaderosTotal }}</p>
        <p>Animales: {{ summary().animalesTotal }}</p>
        <p>Animales activos: {{ summary().animalesActivos }}</p>
        <p>Lotes: {{ summary().lotesTotal }}</p>
        <p>Lotes activos: {{ summary().lotesActivos }}</p>
        <p>Asignaciones activas: {{ summary().asignacionesActivas }}</p>
        <p>Productividad total: {{ summary().productividadTotal }}</p>
        <p>Costos total: {{ summary().costosTotal }}</p>
        <p>Costo acumulado: {{ summary().costoAcumulado }}</p>
      </mat-card>

      <mat-card appearance="outlined">
        <h2>KPIs descriptivos ({{ selectedWindow() }})</h2>
        <p>Animales activos con lote: {{ descriptiveKpis().animalesActivos }}</p>
        <p>Lotes activos: {{ descriptiveKpis().lotesActivos }}</p>
        <p>Entradas productividad: {{ descriptiveKpis().productividadTotal }}</p>
        <p>Entradas costos: {{ descriptiveKpis().costosTotal }}</p>
        <p>Costo acumulado: {{ descriptiveKpis().costoAcumulado }}</p>
      </mat-card>

      <mat-card appearance="outlined">
        <h2>Conteos por tipo ({{ selectedWindow() }})</h2>
        @if (!eventCountEntries().length) {
          <p>No hay eventos para esta ventana.</p>
        } @else {
          @for (entry of eventCountEntries(); track entry.key) {
            <p>{{ entry.key }}: {{ entry.value }}</p>
          }
        }
      </mat-card>

      <mat-card appearance="outlined">
        <h2>Actividad reciente</h2>
        @if (!recentActivity().length) {
          <p>No hay actividad reciente visible.</p>
        } @else {
          @for (item of recentActivity(); track item.id) {
            <article class="activity-item">
              <strong>{{ item.title }}</strong>
              <p>{{ item.animalLabel }} · {{ item.occurredAt }}</p>
            </article>
          }
        }
      </mat-card>

      <mat-card appearance="outlined">
        <h2>Desglose por lote</h2>
        @if (!lotBreakdown().length) {
          <p>No hay lotes visibles para esta ventana.</p>
        } @else {
          @for (lot of lotBreakdown(); track lot.lotId) {
            <article class="activity-item">
              <strong>{{ lot.lotName }}</strong>
              <p>Animales activos: {{ lot.animalesActivos }}</p>
              <p>Productividad: {{ lot.productividadTotal }}</p>
              <p>Costos: {{ lot.costosTotal }} · {{ lot.costoAcumulado }}</p>
            </article>
          }
        }
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

      .controls-row,
      .activity-item {
        display: grid;
        gap: 0.75rem;
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
  readonly statusMessage = this.store.statusMessage;
  readonly selectedWindow = this.store.selectedWindow;
  readonly selectedPreset = this.store.selectedPreset;
  readonly recentActivity = this.store.recentActivity;
  readonly descriptiveKpis = this.store.descriptiveKpis;
  readonly lotBreakdown = this.store.lotBreakdown;
  readonly windows = this.store.allowedWindows;
  readonly presets = this.store.allowedPresets;
  readonly scopeGuardMessage = this.store.scopeGuardMessage;
  readonly eventCountEntries = computed(() =>
    Object.entries(this.store.eventCounts())
      .sort((left, right) => left[0].localeCompare(right[0]))
      .map(([key, value]) => ({ key, value }))
  );

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

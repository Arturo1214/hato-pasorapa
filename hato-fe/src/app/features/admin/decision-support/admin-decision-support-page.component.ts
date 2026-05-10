import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { AdminDecisionSupportStore } from './data-access/admin-decision-support.store';

@Component({
  selector: 'app-admin-decision-support-page',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="decision-support-page">
      <mat-card appearance="outlined">
        <p>{{ scopeGuardMessage() }}</p>
        <p>Última sync: {{ freshness().lastSyncAt ?? 'Sin sync previa' }}</p>
        <p>Último cálculo: {{ freshness().lastComputedAt ?? 'Todavía no calculado' }}</p>
        @if (statusMessage()) {
          <p>{{ statusMessage() }}</p>
        }
        <p>{{ autoApplyMessage() }}</p>
        <button mat-stroked-button type="button" (click)="refresh()">Refrescar ahora</button>
      </mat-card>

      <mat-card appearance="outlined">
        <h2>Ventanas</h2>
        @for (window of allowedWindows(); track window) {
          <button mat-button type="button" (click)="useWindow(window)">{{ window }}</button>
        }
        <p>Ventana: {{ selectedWindow() }}</p>
      </mat-card>

      @for (insight of insights(); track insight.id) {
        <mat-card appearance="outlined">
          <h2>{{ insight.metric }}</h2>
          <p>Severidad: {{ insight.severity }}</p>
          <p>Actual: {{ insight.currentValue }} · Línea base: {{ insight.baselineValue }}</p>
          <p>Fuentes: {{ insight.why.source.join(', ') }}</p>
          <p>Regla: {{ insight.why.rule }}</p>
          <p>Ventana: {{ insight.window }}</p>
          <p>Decisión manual requerida</p>
          @for (action of insight.manualActions; track action) {
            <p>{{ action }}</p>
          }
        </mat-card>
      }
    </section>
  `,
  styles: [
    `
      .decision-support-page {
        display: grid;
        gap: 1rem;
        padding: 1rem;
      }
    `,
  ],
})
export class AdminDecisionSupportPageComponent {
  private readonly store = inject(AdminDecisionSupportStore);
  readonly insights = this.store.insights;
  readonly freshness = this.store.freshness;
  readonly selectedWindow = this.store.selectedWindow;
  readonly statusMessage = this.store.statusMessage;
  readonly scopeGuardMessage = this.store.scopeGuardMessage;
  readonly autoApplyMessage = this.store.autoApplyMessage;
  readonly allowedWindows = this.store.allowedWindows;

  constructor() {
    void this.store.initialize();
  }

  async useWindow(window: '7d' | '30d' | '90d') {
    await this.store.setWindow(window);
  }

  async refresh() {
    await this.store.refreshNow();
  }
}

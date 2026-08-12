import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { ChartsLazyComponent } from '../charts/charts-lazy.component';
import {
  type AdminDashboardMetrics,
  AdminDashboardService,
} from './data-access/admin-dashboard.service';

@Component({
  selector: 'app-admin-dashboard-page',
  imports: [CommonModule, MatCardModule, ChartsLazyComponent],
  template: `
    <section class="admin-page">
      @if (errorMessage()) {
        <mat-card appearance="outlined">
          <p>{{ errorMessage() }}</p>
        </mat-card>
      } @else if (metrics()) {
        @defer (when metrics()) {
          <app-charts-lazy [metrics]="metrics()!" />
        } @placeholder {
          <mat-card appearance="outlined">
            <p>Preparando gráficos del panel…</p>
          </mat-card>
        }
      }
    </section>
  `,
  styles: [
    `
      .admin-page {
        display: grid;
        gap: 1rem;
        padding: 1rem;
      }

      .page-header h1,
      h2 {
        margin: 0 0 0.5rem;
      }
    `,
  ],
})
export class AdminDashboardPageComponent {
  private readonly dashboardService = inject(AdminDashboardService);

  readonly metrics = signal<AdminDashboardMetrics | null>(null);
  readonly errorMessage = signal<string | null>(null);

  constructor() {
    this.dashboardService.loadMetrics().subscribe({
      next: (metrics) => this.metrics.set(metrics),
      error: () => this.errorMessage.set('No pudimos cargar el panel administrativo.'),
    });
  }
}

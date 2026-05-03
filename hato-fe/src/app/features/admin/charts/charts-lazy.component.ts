import { CommonModule } from '@angular/common';
import { Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { BaseChartDirective } from 'ng2-charts';
import type { ChartConfiguration } from 'chart.js';
import type { AdminDashboardMetrics } from '../dashboard/data-access/admin-dashboard.service';

@Component({
  selector: 'app-charts-lazy',
  standalone: true,
  imports: [CommonModule, MatCardModule, BaseChartDirective],
  template: `
    <div class="charts-grid">
      <mat-card appearance="outlined">
        <h2>Usuarios por rol</h2>
        <canvas baseChart [data]="rolesChartData()" [options]="chartOptions" [type]="'bar'"></canvas>
      </mat-card>

      <mat-card appearance="outlined">
        <h2>Estado de ganaderos</h2>
        <canvas baseChart [data]="ganaderosChartData()" [options]="chartOptions" [type]="'doughnut'"></canvas>
      </mat-card>
    </div>
  `,
  styles: [
    `
      .charts-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
      }
    `,
  ],
})
export class ChartsLazyComponent {
  readonly metrics = input.required<AdminDashboardMetrics>();

  readonly chartOptions: ChartConfiguration<'bar' | 'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
  };

  readonly rolesChartData = computed<ChartConfiguration<'bar'>['data']>(() => ({
    labels: ['ADMIN', 'GANADERO'],
    datasets: [
      {
        data: [this.metrics().admins.total, this.metrics().ganaderos.total],
        label: 'Total',
      },
    ],
  }));

  readonly ganaderosChartData = computed<ChartConfiguration<'doughnut'>['data']>(() => ({
    labels: ['Activos', 'Inactivos', 'Bloqueados'],
    datasets: [
      {
        data: [
          this.metrics().ganaderos.active,
          this.metrics().ganaderos.inactive,
          this.metrics().ganaderos.blocked,
        ],
      },
    ],
  }));
}

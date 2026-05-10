import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { BaseChartDirective } from 'ng2-charts';
import type { ChartConfiguration } from 'chart.js';
import { AnimalsSummaryWidgetComponent } from './widgets/animals-summary-widget.component';
import { GanaderoDashboardService } from './data-access/ganadero-dashboard.service';
import { UpcomingEventsWidgetComponent } from './widgets/upcoming-events-widget.component';
import { UnreadNotificationsWidgetComponent } from './widgets/unread-notifications-widget.component';
import { UpcomingVisitsWidgetComponent } from './widgets/upcoming-visits-widget.component';
import { ensureChartJsRegistered } from '../../../shared/ui/charts/chart-js-setup';

ensureChartJsRegistered();

@Component({
  selector: 'app-ganadero-dashboard-page',
  imports: [
    CommonModule,
    MatCardModule,
    BaseChartDirective,
    AnimalsSummaryWidgetComponent,
    UpcomingEventsWidgetComponent,
    UnreadNotificationsWidgetComponent,
    UpcomingVisitsWidgetComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="dashboard-grid">
      <mat-card appearance="outlined" data-testid="dashboard-widget" class="overview-card">
        <h2>Panorama operativo</h2>

        <div class="charts-grid">
          <section>
            <h3>Actividad inmediata</h3>
            <div class="chart-frame">
              <canvas baseChart [data]="activityChartData()" [options]="chartOptions" [type]="'bar'"></canvas>
            </div>
          </section>

          <section>
            <h3>Balance del tablero</h3>
            <div class="chart-frame">
              <canvas baseChart [data]="boardMixChartData()" [options]="chartOptions" [type]="'doughnut'"></canvas>
            </div>
          </section>
        </div>
      </mat-card>

      <app-animals-summary-widget [summary]="dashboardService.animalsSummary()" />
      <app-upcoming-events-widget [events]="dashboardService.upcomingEvents()" />
      <app-unread-notifications-widget [count]="dashboardService.unreadCount()" />
      <app-upcoming-visits-widget [visits]="dashboardService.upcomingVisits()" />
    </section>
  `,
  styles: [
    `
      .dashboard-grid {
        display: grid;
        gap: 1rem;
        padding: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr));
      }

      .overview-card,
      app-animals-summary-widget {
        grid-column: 1 / -1;
      }

      .charts-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(16rem, 1fr));
      }

      .chart-frame {
        position: relative;
        min-height: 16rem;
      }
    `,
  ],
})
export class GanaderoDashboardPageComponent {
  readonly dashboardService = inject(GanaderoDashboardService);
  readonly chartOptions: ChartConfiguration<'bar' | 'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
  };

  readonly totalAnimals = computed(() => {
    const summary = this.dashboardService.animalsSummary();
    if (!summary) {
      return 0;
    }

    return Object.values(summary.machos).reduce((total, value) => total + value, 0)
      + Object.values(summary.hembras).reduce((total, value) => total + value, 0);
  });

  readonly activityChartData = computed<ChartConfiguration<'bar'>['data']>(() => ({
    labels: ['Animales', 'Eventos', 'Visitas', 'No leídas'],
    datasets: [
      {
        label: 'Conteo',
        data: [
          this.totalAnimals(),
          this.dashboardService.upcomingEvents().length,
          this.dashboardService.upcomingVisits().length,
          this.dashboardService.unreadCount(),
        ],
      },
    ],
  }));

  readonly boardMixChartData = computed<ChartConfiguration<'doughnut'>['data']>(() => ({
    labels: ['Eventos próximos', 'Visitas próximas', 'Notificaciones no leídas'],
    datasets: [
      {
        data: [
          this.dashboardService.upcomingEvents().length,
          this.dashboardService.upcomingVisits().length,
          this.dashboardService.unreadCount(),
        ],
      },
    ],
  }));

  constructor() {
    this.dashboardService.loadDashboard();
  }
}

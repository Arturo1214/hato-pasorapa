import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { BaseChartDirective } from 'ng2-charts';
import type { ChartConfiguration } from 'chart.js';
import type { AnimalsSummary } from '../data-access/ganadero-dashboard.service';
import { ensureChartJsRegistered } from '../../../../shared/ui/charts/chart-js-setup';

ensureChartJsRegistered();

@Component({
  selector: 'app-animals-summary-widget',
  imports: [MatCardModule, BaseChartDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card appearance="outlined" data-testid="dashboard-widget">
      <h2>Resumen de animales</h2>
      <div class="summary-kpis">
        <div>
          <strong>{{ totalAnimals() }}</strong>
          <span>Total del rodeo</span>
        </div>
        <div>
          <strong>{{ totalMachos() }}</strong>
          <span>Machos</span>
        </div>
        <div>
          <strong>{{ totalHembras() }}</strong>
          <span>Hembras</span>
        </div>
      </div>

      <div class="charts-grid">
        <section>
          <h3>Composición por categoría</h3>
          <div class="chart-frame">
            <canvas baseChart [data]="categoryChartData()" [options]="chartOptions" [type]="'bar'"></canvas>
          </div>
        </section>

        <section>
          <h3>Distribución por sexo</h3>
          <div class="chart-frame">
            <canvas baseChart [data]="sexChartData()" [options]="chartOptions" [type]="'doughnut'"></canvas>
          </div>
        </section>
      </div>
    </mat-card>
  `,
  styles: [
    `
      .summary-kpis {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(auto-fit, minmax(8rem, 1fr));
        margin-bottom: 1rem;
      }

      .summary-kpis div {
        display: grid;
        gap: 0.25rem;
        padding: 0.875rem;
        border-radius: 0.75rem;
        background: rgba(15, 118, 110, 0.08);
      }

      .summary-kpis strong {
        font-size: 1.5rem;
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
export class AnimalsSummaryWidgetComponent {
  readonly summary = input<AnimalsSummary | null>(null);

  readonly chartOptions: ChartConfiguration<'bar' | 'doughnut'>['options'] = {
    responsive: true,
    maintainAspectRatio: false,
  };

  readonly rows = computed(() => {
    const summary = this.summary();
    return [
      { label: 'Vaquillas', machos: summary?.machos.vaquillas ?? 0, hembras: summary?.hembras.vaquillas ?? 0 },
      { label: 'Vacas', machos: summary?.machos.vacas ?? 0, hembras: summary?.hembras.vacas ?? 0 },
      { label: 'Toros', machos: summary?.machos.toros ?? 0, hembras: summary?.hembras.toros ?? 0 },
      { label: 'Terneros', machos: summary?.machos.terneros ?? 0, hembras: summary?.hembras.terneros ?? 0 },
      { label: 'Bueyes', machos: summary?.machos.bueyes ?? 0, hembras: summary?.hembras.bueyes ?? 0 },
    ];
  });

  readonly totalMachos = computed(() => this.rows().reduce((total, row) => total + row.machos, 0));
  readonly totalHembras = computed(() => this.rows().reduce((total, row) => total + row.hembras, 0));
  readonly totalAnimals = computed(() => this.totalMachos() + this.totalHembras());

  readonly categoryChartData = computed<ChartConfiguration<'bar'>['data']>(() => ({
    labels: this.rows().map((row) => row.label),
    datasets: [
      { label: 'Machos', data: this.rows().map((row) => row.machos) },
      { label: 'Hembras', data: this.rows().map((row) => row.hembras) },
    ],
  }));

  readonly sexChartData = computed<ChartConfiguration<'doughnut'>['data']>(() => ({
    labels: ['Machos', 'Hembras'],
    datasets: [{ data: [this.totalMachos(), this.totalHembras()] }],
  }));
}

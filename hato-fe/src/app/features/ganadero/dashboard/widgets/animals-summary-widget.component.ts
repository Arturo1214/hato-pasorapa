import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import type { AnimalsSummary } from '../data-access/ganadero-dashboard.service';

@Component({
  selector: 'app-animals-summary-widget',
  imports: [MatCardModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card appearance="outlined" data-testid="dashboard-widget">
      <h2>Resumen de animales</h2>
      <div class="summary-grid">
        <strong>Machos</strong>
        <strong>Hembras</strong>
      </div>
      @for (row of rows(); track row.label) {
        <div class="summary-row" data-testid="animals-summary-row">
          <span>{{ row.label }}</span>
          <span>{{ row.machos }}</span>
          <span>{{ row.hembras }}</span>
        </div>
      }
    </mat-card>
  `,
})
export class AnimalsSummaryWidgetComponent {
  readonly summary = input<AnimalsSummary | null>(null);

  readonly rows = () => {
    const summary = this.summary();
    return [
      { label: 'Vaquillas', machos: summary?.machos.vaquillas ?? 0, hembras: summary?.hembras.vaquillas ?? 0 },
      { label: 'Vacas', machos: summary?.machos.vacas ?? 0, hembras: summary?.hembras.vacas ?? 0 },
      { label: 'Toros', machos: summary?.machos.toros ?? 0, hembras: summary?.hembras.toros ?? 0 },
      { label: 'Terneros', machos: summary?.machos.terneros ?? 0, hembras: summary?.hembras.terneros ?? 0 },
      { label: 'Bueyes', machos: summary?.machos.bueyes ?? 0, hembras: summary?.hembras.bueyes ?? 0 },
    ];
  };
}

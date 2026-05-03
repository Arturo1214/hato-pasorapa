import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import type { UpcomingVisit } from '../data-access/ganadero-dashboard.service';

@Component({
  selector: 'app-upcoming-visits-widget',
  imports: [MatCardModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card appearance="outlined" data-testid="dashboard-widget">
      <h2>Próximos controles</h2>
      @if (!visits().length) {
        <p>No hay controles próximos</p>
      } @else {
        @for (visit of visits(); track visit.id) {
          <article>
            <strong>{{ visit.controlType }}</strong>
            <p>{{ visit.plannedDate }}</p>
            <p>{{ visit.status }}</p>
          </article>
        }
      }
    </mat-card>
  `,
})
export class UpcomingVisitsWidgetComponent {
  readonly visits = input<UpcomingVisit[]>([]);
}

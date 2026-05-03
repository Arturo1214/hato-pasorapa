import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import type { UpcomingEvent } from '../data-access/ganadero-dashboard.service';

@Component({
  selector: 'app-upcoming-events-widget',
  imports: [MatCardModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card appearance="outlined" data-testid="dashboard-widget">
      <h2>Próximos eventos</h2>
      @if (!events().length) {
        <p>No hay eventos próximos</p>
      } @else {
        @for (event of events(); track event.id) {
          <article>
            <strong>{{ event.eventType }}</strong>
            <p>{{ event.eventDate }}</p>
            <p>{{ event.description }}</p>
          </article>
        }
      }
    </mat-card>
  `,
})
export class UpcomingEventsWidgetComponent {
  readonly events = input<UpcomingEvent[]>([]);
}

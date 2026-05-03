import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatCardModule } from '@angular/material/card';

@Component({
  selector: 'app-unread-notifications-widget',
  imports: [MatCardModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card appearance="outlined" data-testid="dashboard-widget">
      <h2>Notificaciones</h2>
      <p>Estado actual de avisos pendientes.</p>
      @if (count() > 0) {
        <strong data-testid="unread-count-badge">{{ count() }}</strong>
      }
    </mat-card>
  `,
})
export class UnreadNotificationsWidgetComponent {
  readonly count = input(0);
}

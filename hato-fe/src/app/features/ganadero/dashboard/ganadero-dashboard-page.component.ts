import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AnimalsSummaryWidgetComponent } from './widgets/animals-summary-widget.component';
import { GanaderoDashboardService } from './data-access/ganadero-dashboard.service';
import { UpcomingEventsWidgetComponent } from './widgets/upcoming-events-widget.component';
import { UnreadNotificationsWidgetComponent } from './widgets/unread-notifications-widget.component';
import { UpcomingVisitsWidgetComponent } from './widgets/upcoming-visits-widget.component';

@Component({
  selector: 'app-ganadero-dashboard-page',
  imports: [
    AnimalsSummaryWidgetComponent,
    UpcomingEventsWidgetComponent,
    UnreadNotificationsWidgetComponent,
    UpcomingVisitsWidgetComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="dashboard-grid">
      <app-animals-summary-widget [summary]="dashboardService.animalsSummary()" />
      <app-upcoming-events-widget [events]="dashboardService.upcomingEvents()" />
      <app-unread-notifications-widget [count]="dashboardService.unreadCount()" />
      <app-upcoming-visits-widget [visits]="dashboardService.upcomingVisits()" />
    </section>
  `,
})
export class GanaderoDashboardPageComponent {
  readonly dashboardService = inject(GanaderoDashboardService);

  constructor() {
    this.dashboardService.loadDashboard();
  }
}

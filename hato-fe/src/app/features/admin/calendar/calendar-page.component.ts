import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { CalendarAlertsStore } from './data-access/calendar-alerts.store';

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule],
  templateUrl: './calendar-page.component.html',
  styleUrl: './calendar-page.component.scss',
})
export class CalendarPageComponent {
  readonly store = inject(CalendarAlertsStore);
  readonly counts = this.store.counts;
  readonly timeline = this.store.timeline;
  readonly stale = this.store.stale;
  readonly loading = this.store.loading;
  readonly range = this.store.range;
  readonly preferences = this.store.preferences;
  readonly inAppAlerts = this.store.inAppAlerts;
  readonly isEmpty = computed(() => !this.loading() && this.timeline().length === 0);

  constructor() {
    void this.store.ensureFresh();
  }

  async useRange(range: 'today' | 'next_7_days' | 'next_30_days') {
    this.store.setRange(range);
    await this.store.ensureFresh();
  }

  async refresh() {
    await this.store.rebuild('manual');
  }

  async setHorizon(days: 1 | 3 | 7) {
    await this.store.setHorizonDays(days);
  }

  async snooze() {
    await this.store.snooze();
  }

  async clearSnooze() {
    await this.store.clearSnooze();
  }

  async toggleNotifications() {
    const next = !this.preferences().notificationsEnabled;
    await this.store.setNotificationsEnabled(next);
    if (next) {
      await this.store.requestBrowserPermission();
    }
  }
}

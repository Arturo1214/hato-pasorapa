import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { CalendarAlertsStore } from './data-access/calendar-alerts.store';
import {
  DataTableComponent,
  DATA_TABLE_FILTER_TYPE,
  type DataTableColumn,
  type DataTableRow,
} from '../../../shared/ui/data-table/data-table.component';

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, DataTableComponent],
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
  readonly timelineRows = computed(() => this.timeline() as unknown as DataTableRow[]);
  readonly inAppAlertRows = computed(() => this.inAppAlerts() as unknown as DataTableRow[]);
  readonly timelineFilters = signal<Record<string, string>>({});
  readonly inAppAlertFilters = signal<Record<string, string>>({});
  readonly timelineColumns: DataTableColumn[] = [
    { key: 'title', label: 'Evento', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.TEXT },
    {
      key: 'animalLabel',
      label: 'Animal',
      sortable: true,
      filterType: DATA_TABLE_FILTER_TYPE.TEXT,
      formatter: (value, row) => String(value || (row as { animalUuid?: string }).animalUuid || '—'),
    },
    { key: 'dueAt', label: 'Vence', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.DATE },
    {
      key: 'status',
      label: 'Estado',
      sortable: true,
      filterType: DATA_TABLE_FILTER_TYPE.SELECT,
      filterOptions: [
        { label: 'Próximo', value: 'upcoming' },
        { label: 'Hoy', value: 'due_today' },
        { label: 'Atrasado', value: 'overdue' },
      ],
    },
  ];
  readonly inAppAlertColumns: DataTableColumn[] = [
    { key: 'title', label: 'Alerta', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.TEXT },
    { key: 'status', label: 'Estado', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.SELECT, filterOptions: this.timelineColumns[3].filterOptions },
  ];

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

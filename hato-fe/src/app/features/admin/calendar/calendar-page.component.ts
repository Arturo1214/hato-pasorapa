import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import type { CalendarDerivedAgendaItem } from '../../../core/offline/offline-types';
import { AnimalsHealthEventsService } from '../animals/data-access/animals-health-events.service';
import { mapVetVisitFormToCreateInput } from '../vet-visits/data-access/vet-visit-form.mapper';
import {
  VetVisitFormDialogComponent,
  type VetVisitDialogResult,
} from '../vet-visits/vet-visit-form-dialog.component';
import { CalendarAlertsStore } from './data-access/calendar-alerts.store';
import {
  CALENDAR_WEEKDAY_LABELS,
  addMonths,
  buildCalendarMonthView,
  toLocalDateKey,
  type CalendarMobileViewMode,
} from './data-access/calendar-month-view';

@Component({
  selector: 'app-calendar-page',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule],
  templateUrl: './calendar-page.component.html',
  styleUrl: './calendar-page.component.scss',
})
export class CalendarPageComponent {
  readonly store = inject(CalendarAlertsStore);
  private readonly dialog = inject(MatDialog);
  private readonly healthEventsService = inject(AnimalsHealthEventsService);
  readonly counts = this.store.counts;
  readonly timeline = this.store.timeline;
  readonly stale = this.store.stale;
  readonly loading = this.store.loading;
  readonly visibleMonth = signal(startOfCurrentMonth());
  readonly selectedDate = signal(toLocalDateKey(new Date()));
  readonly mobileViewMode = signal<CalendarMobileViewMode>('month');
  readonly dayDetailOpen = signal(false);
  readonly weekdayLabels = CALENDAR_WEEKDAY_LABELS;
  readonly monthView = computed(() =>
    buildCalendarMonthView({
      items: this.store.agendaItems(),
      visibleMonth: this.visibleMonth(),
      selectedDate: this.selectedDate(),
    }),
  );
  readonly calendarDays = computed(() => this.monthView().days);
  readonly selectedDay = computed(() => this.monthView().selectedDay);
  readonly selectedDayItems = computed(() => this.monthView().selectedDayItems);
  readonly agendaGroups = computed(() => this.monthView().agendaGroups);
  readonly isEmpty = computed(() => !this.loading() && this.store.agendaItems().length === 0);

  constructor() {
    void this.store.ensureFresh();
  }

  previousMonth() {
    this.visibleMonth.set(addMonths(this.visibleMonth(), -1));
  }

  nextMonth() {
    this.visibleMonth.set(addMonths(this.visibleMonth(), 1));
  }

  goToToday() {
    const today = new Date();
    this.visibleMonth.set(startOfCurrentMonth(today));
    this.selectedDate.set(toLocalDateKey(today));
  }

  selectDay(date: string) {
    this.selectedDate.set(date);
    this.dayDetailOpen.set(true);
  }

  closeDayDetail() {
    this.dayDetailOpen.set(false);
  }

  setMobileViewMode(mode: CalendarMobileViewMode) {
    this.mobileViewMode.set(mode);
  }

  openScheduleVisitDialog() {
    this.dialog
      .open(VetVisitFormDialogComponent, {
        width: 'min(92vw, 960px)',
        data: { initialVisitDate: this.selectedDate() },
      })
      .afterClosed()
      .subscribe((result?: VetVisitDialogResult) => {
        if (!result) {
          return;
        }

        this.healthEventsService.createEvent(mapDialogResultToCreateInput(result)).subscribe(() => {
          void this.store.rebuild('manual');
        });
      });
  }

  itemStatusLabel(item: CalendarDerivedAgendaItem) {
    return item.status === 'overdue' ? 'Atrasado' : item.status === 'due_today' ? 'Hoy' : 'Próximo';
  }

  itemSourceLabel(item: CalendarDerivedAgendaItem) {
    if (item.visitMode) {
      return item.visitMode === 'GLOBAL' ? 'Visita global' : 'Visita específica';
    }

    return item.sourceType === 'ANIMAL_REPRODUCTION_EVENT'
      ? 'Reproducción'
      : item.sourceType === 'ANIMAL_EVENT'
        ? 'Evento'
        : 'Salud';
  }
}

function mapDialogResultToCreateInput(result: VetVisitDialogResult) {
  return mapVetVisitFormToCreateInput({
    animalUuid: result.animalUuid,
    visitId: result.visitId,
    mode: result.mode,
    status: result.status,
    occurredAt: result.occurredAt,
    notes: result.notes,
    checklist: [],
    creationMode: result.creationMode,
    clinicalNote: {
      reason: result.reason,
      findings: result.findings ?? '',
      plan: result.treatmentPlan ?? '',
    },
    protocolStatus: protocolStatusFromVisitStatus(
      result.status,
      result.nextDueAt,
      result.followUpChoice,
    ),
    nextDueAt: result.nextDueAt,
    veterinarianName: result.veterinarianName,
    veterinarianLicense: result.veterinarianLicense,
    targetAnimalCount: result.targetAnimalCount,
    parentVisitId: result.parentVisitId,
    cost: result.cost,
    treatmentPlan: result.treatmentPlan,
    followUpChoice: result.followUpChoice,
  });
}

function protocolStatusFromVisitStatus(
  status: VetVisitDialogResult['status'],
  nextDueAt: string | null,
  followUpChoice?: VetVisitDialogResult['followUpChoice'],
) {
  if (followUpChoice === 'finalize') {
    return 'CLOSED';
  }
  if (followUpChoice === 'schedule') {
    return 'FOLLOW_UP_REQUIRED';
  }
  if (status === 'FINALIZED' || status === 'CANCELED') {
    return 'CLOSED';
  }
  if (status === 'RESCHEDULED' || nextDueAt) {
    return 'FOLLOW_UP_REQUIRED';
  }
  return 'STARTED';
}

function startOfCurrentMonth(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

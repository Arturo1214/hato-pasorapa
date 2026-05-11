import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { finalize } from 'rxjs';
import {
  DataTableComponent,
  DATA_TABLE_FILTER_TYPE,
  type DataTableAction,
  type DataTableColumn,
  type DataTableRow,
  type DataTableRowActionEvent,
} from '../../../shared/ui/data-table/data-table.component';
import { AnimalsHealthEventsService } from '../animals/data-access/animals-health-events.service';
import { mapVetVisitFormToCreateInput } from './data-access/vet-visit-form.mapper';
import { VetVisitsService, type VetVisitFilter, type VetVisitItem } from './data-access/vet-visits.service';
import {
  VetVisitFormDialogComponent,
  type VetVisitDialogResult,
} from './vet-visit-form-dialog.component';

type VetVisitMode = VetVisitItem['mode'];
type VetVisitStatus = VetVisitItem['status'];

interface VetVisitRow extends DataTableRow, VetVisitItem {
  modeLabel: string;
  statusLabel: string;
  veterinarianName: string;
}

@Component({
  selector: 'app-vet-visits-page',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, DataTableComponent],
  template: `
    <section class="admin-page">
      <div class="toolbar-actions" aria-label="Acciones de visitas veterinarias">
        <button mat-flat-button color="primary" class="primary-action-button" type="button" (click)="openNewVisitDialog()">
          <mat-icon>add</mat-icon>
          <span>Nueva Visita</span>
        </button>
      </div>

      @if (feedbackMessage()) {
        <mat-card appearance="outlined"><p>{{ feedbackMessage() }}</p></mat-card>
      }

      <mat-card appearance="outlined" class="table-card">
        <app-data-table
          [columns]="visitColumns"
          [data]="visitRows()"
          [actions]="visitActions"
          [filters]="visitFilters()"
          [loading]="loading()"
          emptyMessage="No hay visitas veterinarias para los filtros seleccionados."
          (filterChange)="handleFiltersChange($event)"
          (rowAction)="handleRowAction($event)"
        />
      </mat-card>
    </section>
  `,
  styles: [
    `
      .admin-page { display: grid; gap: 1rem; padding: 1rem; }
      .toolbar-actions { display: flex; justify-content: flex-end; gap: 1rem; }
      .primary-action-button { border-radius: 999px; }
      .primary-action-button mat-icon { margin-inline-end: .25rem; }
      .table-card { padding: .75rem; }
      @media (max-width: 720px) { .toolbar-actions { justify-content: stretch; } .primary-action-button { width: 100%; } }
    `,
  ],
})
export class VetVisitsPageComponent {
  private readonly vetVisitsService = inject(VetVisitsService);
  private readonly healthEventsService = inject(AnimalsHealthEventsService);
  private readonly dialog = inject(MatDialog);

  readonly loading = signal(false);
  readonly submitting = signal(false);
  readonly feedbackMessage = signal<string | null>(null);
  readonly visitFilters = signal<Record<string, string>>({});
  readonly visits = signal<VetVisitItem[]>([]);
  readonly visitRows = signal<VetVisitRow[]>([]);

  readonly visitColumns: DataTableColumn[] = [
    { key: 'visitId', label: 'Visita', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.TEXT },
    {
      key: 'modeLabel',
      label: 'Modo',
      sortable: true,
      filterType: DATA_TABLE_FILTER_TYPE.SELECT,
      filterOptions: [
        { label: 'Campaña', value: 'Campaña' },
        { label: 'Específica', value: 'Específica' },
      ],
    },
    { key: 'veterinarianName', label: 'Veterinario', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.TEXT },
    {
      key: 'statusLabel',
      label: 'Estado',
      sortable: true,
      filterType: DATA_TABLE_FILTER_TYPE.SELECT,
      filterOptions: Object.entries(VISIT_STATUS_LABELS).map(([value, label]) => ({ value: label, label })),
    },
    { key: 'occurredAt', label: 'Fecha', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.DATE, formatter: formatDateTime },
    { key: 'nextControlAt', label: 'Siguiente Control', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.DATE, formatter: formatDateTime },
  ];

  readonly visitActions: DataTableAction[] = [
    { id: 'attend', label: 'Atender', icon: 'medical_services', visible: (row) => canAttend(row as VetVisitRow) },
    { id: 'reschedule', label: 'Reprogramar', icon: 'event_repeat', visible: (row) => canContinue(row as VetVisitRow) },
    { id: 'finalize', label: 'Finalizar', icon: 'task_alt', visible: (row) => canClose(row as VetVisitRow) },
    { id: 'cancel', label: 'Cancelar', icon: 'cancel', color: 'warn', visible: (row) => canCancel(row as VetVisitRow) },
  ];

  constructor() {
    this.loadVisits();
  }

  loadVisits(filter: VetVisitFilter = { page: 0, size: 20 }, recentlySavedVisit?: VetVisitItem) {
    this.loading.set(true);
    this.vetVisitsService
      .listVetVisits(filter)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((items) => {
        const visibleItems = mergeRecentlySavedVisit(items, recentlySavedVisit, filter);
        this.visits.set(visibleItems);
        this.visitRows.set(visibleItems.map(toVetVisitRow));
      });
  }

  handleFiltersChange(filters: Record<string, string>) {
    this.visitFilters.set(filters);
    this.loadVisits(toBackendFilter(filters));
  }

  openNewVisitDialog() {
    this.dialog
      .open(VetVisitFormDialogComponent, { width: 'min(92vw, 960px)' })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.createVisit(result);
        }
      });
  }

  handleRowAction(event: DataTableRowActionEvent) {
    const row = event.row as VetVisitRow;
    const data = {
      mode: row.mode,
      parentVisitId: row.visitId,
      targetAnimalCount: row.targetAnimalCount,
    };
    this.dialog.open(VetVisitFormDialogComponent, { width: 'min(92vw, 960px)', data });
  }

  private createVisit(result: VetVisitDialogResult) {
    this.submitting.set(true);
    this.feedbackMessage.set(null);
    this.healthEventsService
      .createEvent(mapDialogResultToCreateInput(result))
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe((feedback) => {
        this.feedbackMessage.set(feedback.message);
        const currentFilter = toBackendFilter(this.visitFilters());
        this.loadVisits(currentFilter, toVetVisitItem(result));
      });
  }
}

const VISIT_MODE_LABELS: Record<VetVisitMode, string> = {
  GLOBAL: 'Campaña',
  SPECIFIC: 'Específica',
};

const VISIT_STATUS_LABELS: Record<VetVisitStatus, string> = {
  PENDING: 'Programada',
  ATTENDED: 'Atendida',
  RESCHEDULED: 'Reprogramada',
  FINALIZED: 'Finalizada',
  CANCELED: 'Cancelada',
};

function toVetVisitRow(item: VetVisitItem): VetVisitRow {
  return {
    ...item,
    modeLabel: VISIT_MODE_LABELS[item.mode],
    statusLabel: VISIT_STATUS_LABELS[item.status],
    veterinarianName: item.veterinarian?.name ?? '—',
  };
}

function toBackendFilter(filters: Record<string, string>): VetVisitFilter {
  const mode = modeFromLabel(filters['mode'] || filters['modeLabel']);
  const status = statusFromLabel(filters['status'] || filters['statusLabel']);
  const veterinarian = filters['veterinarian'] || filters['veterinarianName'];
  return {
    page: 0,
    size: 20,
    ...(mode ? { mode } : {}),
    ...(status ? { status } : {}),
    ...(veterinarian?.trim() ? { veterinarian: veterinarian.trim() } : {}),
  };
}

function toVetVisitItem(result: VetVisitDialogResult): VetVisitItem {
  return {
    visitId: result.visitId,
    mode: result.mode,
    status: result.status,
    veterinarian: {
      name: result.veterinarianName,
      ...(result.veterinarianLicense ? { license: result.veterinarianLicense } : {}),
    },
    occurredAt: result.occurredAt,
    nextControlAt: result.nextDueAt,
    animalUuid: result.animalUuid,
    targetAnimalCount: result.targetAnimalCount,
    atencionNotas: result.notes,
    costo: null,
    costCurrency: null,
    treatmentPlan: null,
  };
}

function mergeRecentlySavedVisit(
  items: VetVisitItem[],
  recentlySavedVisit: VetVisitItem | undefined,
  filter: VetVisitFilter
): VetVisitItem[] {
  if (!recentlySavedVisit || items.some((item) => item.visitId === recentlySavedVisit.visitId)) {
    return items;
  }

  if (!matchesVetVisitFilter(recentlySavedVisit, filter)) {
    return items;
  }

  return [recentlySavedVisit, ...items];
}

function matchesVetVisitFilter(item: VetVisitItem, filter: VetVisitFilter) {
  return (
    matchesNullableFilter(item.mode, filter.mode) &&
    matchesNullableFilter(item.status, filter.status) &&
    matchesNullableFilter(item.animalUuid, filter.animalUuid) &&
    matchesNullableFilter(item.visitId, filter.visitId) &&
    matchesVeterinarianFilter(item, filter.veterinarian) &&
    matchesOccurredAtRange(item, filter)
  );
}

function matchesNullableFilter<T extends string>(value: T | null, filterValue: T | '' | null | undefined) {
  return !filterValue || value === filterValue;
}

function matchesVeterinarianFilter(item: VetVisitItem, veterinarianFilter: string | null | undefined) {
  const normalizedFilter = veterinarianFilter?.trim().toLowerCase();
  if (!normalizedFilter) {
    return true;
  }
  return item.veterinarian?.name.toLowerCase().includes(normalizedFilter) ?? false;
}

function matchesOccurredAtRange(item: VetVisitItem, filter: VetVisitFilter) {
  if (filter.occurredFrom && item.occurredAt < filter.occurredFrom) {
    return false;
  }
  if (filter.occurredTo && item.occurredAt > filter.occurredTo) {
    return false;
  }
  return true;
}

function modeFromLabel(value: string | undefined): VetVisitMode | undefined {
  return Object.entries(VISIT_MODE_LABELS).find(([, label]) => label.toLowerCase() === value?.toLowerCase())?.[0] as VetVisitMode | undefined;
}

function statusFromLabel(value: string | undefined): VetVisitStatus | undefined {
  return Object.entries(VISIT_STATUS_LABELS).find(([, label]) => label.toLowerCase() === value?.toLowerCase())?.[0] as VetVisitStatus | undefined;
}

function canAttend(row: VetVisitRow) {
  return row.status === 'PENDING' || row.status === 'RESCHEDULED';
}

function canContinue(row: VetVisitRow) {
  return row.status === 'ATTENDED';
}

function canClose(row: VetVisitRow) {
  return row.status === 'PENDING' || row.status === 'ATTENDED' || row.status === 'RESCHEDULED';
}

function canCancel(row: VetVisitRow) {
  return row.status === 'PENDING' || row.status === 'RESCHEDULED';
}

function formatDateTime(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) {
    return '—';
  }
  return new Intl.DateTimeFormat('es-BO', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
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
    clinicalNote: {
      reason: result.reason,
      findings: '',
      plan: '',
    },
    protocolStatus: protocolStatusFromVisitStatus(result.status, result.nextDueAt),
    nextDueAt: result.nextDueAt,
    veterinarianName: result.veterinarianName,
    veterinarianLicense: result.veterinarianLicense,
    targetAnimalCount: result.targetAnimalCount,
    parentVisitId: result.parentVisitId,
  });
}

function protocolStatusFromVisitStatus(status: VetVisitDialogResult['status'], nextDueAt: string | null) {
  if (status === 'FINALIZED' || status === 'CANCELED') {
    return 'CLOSED';
  }
  if (status === 'RESCHEDULED' || nextDueAt) {
    return 'FOLLOW_UP_REQUIRED';
  }
  return 'STARTED';
}

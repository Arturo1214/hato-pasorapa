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
      <mat-card appearance="outlined" class="toolbar-card">
        <div class="toolbar-card__content">
          <p>Listado central de campañas y visitas específicas, con filtros operativos y acciones por estado.</p>
          <button mat-flat-button color="primary" type="button" (click)="openNewVisitDialog()">
            <mat-icon>add</mat-icon>
            Nueva Visita
          </button>
        </div>
      </mat-card>

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
      .toolbar-card__content { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
      .toolbar-card__content p { margin: 0; color: var(--mat-sys-on-surface-variant); }
      .toolbar-card__content button { border-radius: 999px; }
      .toolbar-card__content mat-icon { margin-inline-end: .25rem; }
      .table-card { padding: .75rem; }
      @media (max-width: 720px) { .toolbar-card__content { align-items: stretch; flex-direction: column; } }
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

  loadVisits(filter: VetVisitFilter = { page: 0, size: 20 }) {
    this.loading.set(true);
    this.vetVisitsService
      .listVetVisits(filter)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe((items) => {
        this.visits.set(items);
        this.visitRows.set(items.map(toVetVisitRow));
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
        this.loadVisits(toBackendFilter(this.visitFilters()));
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
  return row.status === 'ATTENDED' || row.status === 'RESCHEDULED';
}

function canCancel(row: VetVisitRow) {
  return row.status !== 'FINALIZED' && row.status !== 'CANCELED';
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
      findings: result.findings,
      plan: result.plan,
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

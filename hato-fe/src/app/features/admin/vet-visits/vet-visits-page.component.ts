import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { concatMap, finalize, map } from 'rxjs';
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
import {
  VetVisitCancelDialogComponent,
  type VetVisitCancelDialogResult,
} from './vet-visit-cancel-dialog.component';
import { VetVisitDetailDialogComponent } from './vet-visit-detail-dialog.component';

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
    { id: 'view', label: 'Ver', icon: 'visibility' },
    { id: 'attend', label: 'Atender', icon: 'medical_services', visible: (row) => canAttend(row as VetVisitRow) },
    { id: 'cancel', label: 'Cancelar', icon: 'cancel', color: 'warn', visible: (row) => canCancel(row as VetVisitRow) },
  ];

  constructor() {
    this.loadVisits();
  }

  loadVisits(filter: VetVisitFilter = { page: 0, size: 20 }, recentlySavedVisit?: VetVisitItem | VetVisitItem[]) {
    this.reloadVisits$(filter, recentlySavedVisit).subscribe();
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
    if (event.actionId === 'view') {
      this.openDetailVisitDialog(row);
      return;
    }
    if (event.actionId === 'cancel') {
      if (!canCancel(row)) {
        return;
      }
      this.openCancelVisitDialog(row);
      return;
    }
    if (event.actionId === 'attend') {
      if (!canAttend(row)) {
        return;
      }
      this.openAttendVisitDialog(row);
      return;
    }
  }

  private openDetailVisitDialog(row: VetVisitRow) {
    this.vetVisitsService.getVetVisitChain(row.visitId).subscribe((chain) => {
      this.dialog.open(VetVisitDetailDialogComponent, {
        width: 'min(92vw, 960px)',
        data: { visit: row, chain },
      });
    });
  }

  private openCancelVisitDialog(row: VetVisitRow) {
    this.dialog
      .open(VetVisitCancelDialogComponent, { width: 'min(92vw, 32rem)' })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.cancelVisit(row, result);
        }
      });
  }

  private openAttendVisitDialog(row: VetVisitRow) {
    this.dialog
      .open(VetVisitFormDialogComponent, {
        width: 'min(92vw, 960px)',
        data: {
          action: 'attend',
          creationMode: 'attendedNow',
          visitId: row.visitId,
          status: 'ATTENDED',
          mode: row.mode,
          animalUuid: row.animalUuid,
          occurredAt: row.occurredAt,
          nextDueAt: row.nextControlAt,
          reason: row.atencionNotas ?? 'Visita veterinaria',
          veterinarianName: row.veterinarian?.name ?? '',
          veterinarianLicense: row.veterinarian?.license ?? null,
          parentVisitId: row.parentVisitId,
          targetAnimalCount: row.targetAnimalCount,
        },
      })
      .afterClosed()
      .subscribe((result) => {
        if (result) {
          this.attendVisit(row, result);
        }
      });
  }

  private createVisit(result: VetVisitDialogResult) {
    this.submitting.set(true);
    this.feedbackMessage.set(null);
    const currentFilter = toBackendFilter(this.visitFilters());
    const recentlySavedVisits = buildRecentlySavedVisitsForCreate(result);
    this.healthEventsService
      .createEvent(mapDialogResultToCreateInput(result))
      .pipe(
        concatMap((feedback) => {
          if (result.creationMode === 'attendedNow' && result.followUpChoice === 'schedule' && result.nextDueAt) {
            const followUpResult = buildFollowUpDialogResultFromCreate(result);
            return this.healthEventsService
              .createEvent(mapDialogResultToCreateInput(followUpResult))
              .pipe(concatMap(() => this.reloadVisits$(currentFilter, recentlySavedVisits)), map(() => feedback));
          }

          return this.reloadVisits$(currentFilter, recentlySavedVisits).pipe(map(() => feedback));
        }),
        finalize(() => this.submitting.set(false))
      )
      .subscribe((feedback) => {
        this.feedbackMessage.set(feedback.message);
      });
  }

  private cancelVisit(row: VetVisitRow, result: VetVisitCancelDialogResult) {
    this.submitting.set(true);
    this.feedbackMessage.set(null);
    const canceledVisit = toVetVisitItemFromRow(row, { status: 'CANCELED', cancelReason: result.cancelReason, chainStatus: null });
    this.healthEventsService
      .createEvent(mapRowActionToCreateInput(row, {
        action: 'cancel',
        status: 'CANCELED',
        cancelReason: result.cancelReason,
        protocolStatus: 'CLOSED',
      }))
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe((feedback) => {
        this.feedbackMessage.set(feedback.message);
        this.loadVisits(toBackendFilter(this.visitFilters()), canceledVisit);
      });
  }

  private attendVisit(row: VetVisitRow, result: VetVisitDialogResult) {
    this.submitting.set(true);
    this.feedbackMessage.set(null);
    const attendedStatus = 'ATTENDED';
    const attendedInput = mapDialogResultToCreateInput({ ...result, visitId: row.visitId, status: attendedStatus, parentVisitId: row.parentVisitId });

    if (result.followUpChoice === 'schedule' && result.nextDueAt) {
      const followUpResult = buildFollowUpDialogResult(row, result);
      this.healthEventsService
        .createEvent(attendedInput)
        .pipe(
          concatMap(() => this.healthEventsService.createEvent(mapDialogResultToCreateInput(followUpResult))),
          finalize(() => this.submitting.set(false))
        )
        .subscribe((feedback) => {
          this.feedbackMessage.set(feedback.message);
          this.loadVisits(toBackendFilter(this.visitFilters()));
        });
      return;
    }

    this.healthEventsService
      .createEvent(attendedInput)
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe((feedback) => {
        this.feedbackMessage.set(feedback.message);
        this.loadVisits(toBackendFilter(this.visitFilters()));
      });
  }

  private reloadVisits$(filter: VetVisitFilter = { page: 0, size: 20 }, recentlySavedVisit?: VetVisitItem | VetVisitItem[]) {
    this.loading.set(true);
    return this.vetVisitsService.listVetVisits(filter).pipe(
      map((items) => {
        const visibleItems = mergeRecentlySavedVisit(items, recentlySavedVisit, filter);
        this.visits.set(visibleItems);
        this.visitRows.set(visibleItems.map(toVetVisitRow));
        return visibleItems;
      }),
      finalize(() => this.loading.set(false))
    );
  }
}

const VISIT_MODE_LABELS: Record<VetVisitMode, string> = {
  GLOBAL: 'Campaña',
  SPECIFIC: 'Específica',
};

const VISIT_STATUS_LABELS: Partial<Record<VetVisitStatus, string>> = {
  PENDING: 'Programada',
  ATTENDED: 'Atendida',
  CANCELED: 'Cancelada',
};

function toVetVisitRow(item: VetVisitItem): VetVisitRow {
  return {
    ...item,
    modeLabel: VISIT_MODE_LABELS[item.mode],
    statusLabel: VISIT_STATUS_LABELS[item.status] ?? item.status,
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
    parentVisitId: result.parentVisitId,
    cancelReason: null,
    chainStatus: result.status === 'ATTENDED' && result.followUpChoice === 'finalize' ? 'CLOSED' : result.status === 'ATTENDED' ? 'OPEN' : null,
    animalUuid: result.animalUuid,
    targetAnimalCount: result.targetAnimalCount,
    atencionNotas: result.notes,
    findings: result.findings ?? null,
    costo: null,
    costCurrency: null,
    treatmentPlan: null,
  };
}

function buildRecentlySavedVisitsForCreate(result: VetVisitDialogResult): VetVisitItem | VetVisitItem[] {
  if (result.creationMode === 'attendedNow' && result.followUpChoice === 'schedule' && result.nextDueAt) {
    return [toVetVisitItem(result), toVetVisitItem(buildFollowUpDialogResultFromCreate(result))];
  }
  return toVetVisitItem(result);
}

function mergeRecentlySavedVisit(
  items: VetVisitItem[],
  recentlySavedVisit: VetVisitItem | VetVisitItem[] | undefined,
  filter: VetVisitFilter
): VetVisitItem[] {
  const recentlySavedVisits = Array.isArray(recentlySavedVisit)
    ? recentlySavedVisit
    : recentlySavedVisit ? [recentlySavedVisit] : [];
  if (!recentlySavedVisits.length) {
    return items;
  }

  const matchingSavedVisits = recentlySavedVisits.filter((item) => matchesVetVisitFilter(item, filter));
  if (!matchingSavedVisits.length) {
    return items;
  }

  const savedByVisitId = new Map(matchingSavedVisits.map((item) => [item.visitId, item]));
  const merged = items.map((item) => savedByVisitId.get(item.visitId) ?? item);
  const existingVisitIds = new Set(merged.map((item) => item.visitId));
  const existingParentVisitIds = new Set(merged.map((item) => item.parentVisitId).filter(Boolean));
  for (const savedVisit of matchingSavedVisits) {
    if (existingVisitIds.has(savedVisit.visitId)) {
      continue;
    }
    if (savedVisit.parentVisitId && existingParentVisitIds.has(savedVisit.parentVisitId)) {
      continue;
    }
    const parentIndex = savedVisit.parentVisitId
      ? merged.findIndex((item) => item.visitId === savedVisit.parentVisitId)
      : -1;
    if (parentIndex >= 0) {
      merged.splice(parentIndex + 1, 0, savedVisit);
    } else {
      merged.unshift(savedVisit);
    }
    existingVisitIds.add(savedVisit.visitId);
    if (savedVisit.parentVisitId) {
      existingParentVisitIds.add(savedVisit.parentVisitId);
    }
  }
  return merged;
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
  return row.status === 'PENDING' && row.chainStatus !== 'CLOSED';
}

function canCancel(row: VetVisitRow) {
  return row.status === 'PENDING' && row.chainStatus !== 'CLOSED';
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
    creationMode: result.creationMode,
    clinicalNote: {
      reason: result.reason,
      findings: result.findings ?? '',
      plan: result.treatmentPlan ?? '',
    },
    protocolStatus: protocolStatusFromVisitStatus(result.status, result.nextDueAt, result.followUpChoice),
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

function protocolStatusFromVisitStatus(status: VetVisitDialogResult['status'], nextDueAt: string | null, followUpChoice?: VetVisitDialogResult['followUpChoice']) {
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

function mapRowActionToCreateInput(
  row: VetVisitRow,
  overrides: Partial<Parameters<typeof mapVetVisitFormToCreateInput>[0]>
) {
  return mapVetVisitFormToCreateInput({
    action: overrides.action,
    animalUuid: row.animalUuid,
    visitId: row.visitId,
    mode: row.mode,
    status: overrides.status ?? row.status,
    occurredAt: row.occurredAt,
    notes: overrides.notes ?? row.atencionNotas,
    checklist: [],
    clinicalNote: {
      reason: overrides.clinicalNote?.reason ?? row.atencionNotas ?? 'Visita veterinaria',
      findings: overrides.clinicalNote?.findings ?? '',
      plan: overrides.clinicalNote?.plan ?? row.treatmentPlan ?? '',
    },
    protocolStatus: overrides.protocolStatus ?? protocolStatusFromVisitStatus(overrides.status ?? row.status, row.nextControlAt),
    nextDueAt: overrides.nextDueAt ?? row.nextControlAt,
    veterinarianName: row.veterinarian?.name ?? '',
    veterinarianLicense: row.veterinarian?.license ?? null,
    targetAnimalCount: row.targetAnimalCount,
    parentVisitId: overrides.parentVisitId ?? row.parentVisitId,
    cancelReason: overrides.cancelReason,
    cost: overrides.cost,
    treatmentPlan: overrides.treatmentPlan,
    followUpChoice: overrides.followUpChoice,
  });
}

function toVetVisitItemFromRow(row: VetVisitRow, overrides: Partial<VetVisitItem>): VetVisitItem {
  return {
    visitId: overrides.visitId ?? row.visitId,
    mode: overrides.mode ?? row.mode,
    status: overrides.status ?? row.status,
    veterinarian: overrides.veterinarian ?? row.veterinarian,
    occurredAt: overrides.occurredAt ?? row.occurredAt,
    nextControlAt: overrides.nextControlAt ?? row.nextControlAt,
    parentVisitId: overrides.parentVisitId ?? row.parentVisitId,
    cancelReason: overrides.cancelReason ?? row.cancelReason,
    chainStatus: overrides.chainStatus ?? row.chainStatus,
    animalUuid: overrides.animalUuid ?? row.animalUuid,
    targetAnimalCount: overrides.targetAnimalCount ?? row.targetAnimalCount,
    atencionNotas: overrides.atencionNotas ?? row.atencionNotas,
    findings: overrides.findings ?? row.findings,
    costo: overrides.costo ?? row.costo,
    costCurrency: overrides.costCurrency ?? row.costCurrency,
    treatmentPlan: overrides.treatmentPlan ?? row.treatmentPlan,
  };
}

function buildFollowUpDialogResult(row: VetVisitRow, attendResult: VetVisitDialogResult): VetVisitDialogResult {
  return {
    mode: row.mode,
    creationMode: 'scheduled',
    animalUuid: row.animalUuid,
    visitId: createLocalVisitId(),
    status: 'PENDING',
    occurredAt: attendResult.nextDueAt ?? attendResult.occurredAt,
    nextDueAt: null,
    notes: null,
    reason: attendResult.reason,
    veterinarianName: attendResult.veterinarianName,
    veterinarianLicense: attendResult.veterinarianLicense,
    targetAnimalCount: row.targetAnimalCount,
    parentVisitId: row.visitId,
  };
}

function buildFollowUpDialogResultFromCreate(parentResult: VetVisitDialogResult): VetVisitDialogResult {
  return {
    mode: parentResult.mode,
    creationMode: 'scheduled',
    animalUuid: parentResult.animalUuid,
    visitId: createLocalVisitId(),
    status: 'PENDING',
    occurredAt: parentResult.nextDueAt ?? parentResult.occurredAt,
    nextDueAt: null,
    notes: null,
    reason: parentResult.reason,
    veterinarianName: parentResult.veterinarianName,
    veterinarianLicense: parentResult.veterinarianLicense,
    targetAnimalCount: parentResult.targetAnimalCount,
    parentVisitId: parentResult.visitId,
  };
}

function createLocalVisitId() {
  return globalThis.crypto?.randomUUID?.() ?? `vet-follow-up-${Date.now()}`;
}

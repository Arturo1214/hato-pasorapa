import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { auditTime, finalize } from 'rxjs';
import { OfflineEntityChangeBus } from '../../../core/offline/offline-entity-change-bus.service';
import { OfflineStatusService } from '../../../core/offline/offline-status.service';
import {
  ConfirmationDialogComponent,
  CONFIRMATION_DIALOG_TONE,
} from '../../../shared/ui/confirmation-dialog/confirmation-dialog.component';
import {
  DataTableComponent,
  DATA_TABLE_FILTER_TYPE,
  type DataTableAction,
  type DataTableColumn,
  type DataTableRowActionEvent,
} from '../../../shared/ui/data-table/data-table.component';
import { RazasService, type RazaItem } from './data-access/razas.service';
import {
  RAZA_DIALOG_MODE,
  RazaFormDialogComponent,
  type RazaDialogResult,
} from './raza-form-dialog.component';

@Component({
  selector: 'app-razas-page',
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, DataTableComponent],
  template: `
    <section class="admin-page">
      <mat-card appearance="outlined" class="status-card">
        @if (offlineMessage()) {
          <p>{{ offlineMessage() }}</p>
        }
        <p>La gestión de razas requiere conexión. El catálogo es administrativo y solo funciona con conexión.</p>
      </mat-card>

      <div class="toolbar-actions">
        <button
          mat-flat-button
          color="primary"
          type="button"
          [disabled]="sensitiveActionsOnlineOnly()"
          (click)="openCreateDialog()"
        >
          <mat-icon>add</mat-icon>
          Nueva raza
        </button>
      </div>

      @if (feedbackMessage()) {
        <mat-card appearance="outlined" role="status" aria-live="polite"
          ><p>{{ feedbackMessage() }}</p></mat-card
        >
      }

      @if (errorMessage()) {
        <mat-card appearance="outlined" role="alert" aria-live="assertive"
          ><p>{{ errorMessage() }}</p></mat-card
        >
      }

      <mat-card appearance="outlined" class="table-card">
        <app-data-table
          [columns]="columns"
          [data]="razas()"
          [filters]="filters()"
          [actions]="actions"
          [loading]="loading()"
          emptyMessage="Todavía no hay razas registradas."
          (filterChange)="filters.set($event)"
          (rowAction)="handleRowAction($event)"
        />
      </mat-card>
    </section>
  `,
  styles: [
    `
      .admin-page {
        display: grid;
        gap: 1rem;
        padding: 1rem;
      }

      .toolbar-actions {
        display: flex;
        justify-content: flex-end;
      }

      .toolbar-actions button {
        border-radius: 999px;
      }

      .toolbar-actions mat-icon {
        margin-inline-end: 0.35rem;
      }

      .status-card p {
        margin: 0.25rem 0;
      }

      .table-card {
        padding: 0.75rem;
      }
    `,
  ],
})
export class RazasPageComponent {
  private readonly razasService = inject(RazasService);
  private readonly offlineStatus = inject(OfflineStatusService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly entityChangeBus = inject(OfflineEntityChangeBus);
  private readonly recentlySavedRazas = signal<ReadonlyMap<string, RazaItem>>(new Map());

  readonly razas = signal<RazaItem[]>([]);
  readonly errorMessage = signal<string | null>(null);
  readonly feedbackMessage = signal<string | null>(null);
  readonly loading = signal(false);
  readonly offlineMessage = this.offlineStatus.message;
  readonly sensitiveActionsOnlineOnly = computed(() => this.offlineMessage() !== null);
  readonly filters = signal<Record<string, string>>({});
  readonly columns: DataTableColumn[] = [
    { key: 'nombre', label: 'Nombre', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.TEXT },
    {
      key: 'descripcion',
      label: 'Descripción',
      filterType: DATA_TABLE_FILTER_TYPE.TEXT,
      formatter: (value) => String(value ?? '—'),
    },
    {
      key: 'origen',
      label: 'Origen',
      sortable: true,
      filterType: DATA_TABLE_FILTER_TYPE.TEXT,
      formatter: (value) => String(value ?? '—'),
    },
    {
      key: 'activo',
      label: 'Estado',
      sortable: true,
      filterType: DATA_TABLE_FILTER_TYPE.SELECT,
      filterOptions: [
        { label: 'Activa', value: 'true' },
        { label: 'Inactiva', value: 'false' },
      ],
      formatter: (value) => (value ? 'Activa' : 'Inactiva'),
    },
    {
      key: 'sortOrder',
      label: 'Orden',
      sortable: true,
      formatter: (value) => String(value ?? '—'),
    },
    {
      key: 'updatedAt',
      label: 'Actualizada',
      sortable: true,
      formatter: (value) => this.formatDate(value),
    },
  ];
  readonly actions: DataTableAction[] = [
    { id: 'edit', label: 'Editar', icon: 'edit' },
    {
      id: 'toggle-active',
      label: 'Activar/desactivar',
      icon: 'toggle_off',
      color: 'warn',
    },
  ];

  constructor() {
    this.loadRazas();
    this.entityChangeBus
      .watch(['RAZA'])
      .pipe(auditTime(50), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadRazas());
  }

  openCreateDialog() {
    if (this.sensitiveActionsOnlineOnly()) {
      return;
    }

    this.dialog
      .open(RazaFormDialogComponent, { data: { mode: RAZA_DIALOG_MODE.CREATE } })
      .afterClosed()
      .subscribe((result: RazaDialogResult | undefined) => {
        if (!result) {
          return;
        }

        this.errorMessage.set(null);
        this.feedbackMessage.set(null);
        const { activo: _activo, ...payload } = result;
        this.razasService.create(payload).subscribe({
          next: (response) => this.handleMutationFeedback(response),
          error: () => this.errorMessage.set('No pudimos crear la raza.'),
        });
      });
  }

  handleRowAction(event: DataTableRowActionEvent) {
    const raza = event.row as unknown as RazaItem;

    if (event.actionId === 'edit') {
      this.openEditDialog(raza);
      return;
    }

    if (event.actionId === 'toggle-active') {
      this.confirmActiveToggle(raza);
    }
  }

  private openEditDialog(raza: RazaItem) {
    if (this.sensitiveActionsOnlineOnly()) {
      return;
    }

    this.dialog
      .open(RazaFormDialogComponent, { data: { mode: RAZA_DIALOG_MODE.EDIT, raza } })
      .afterClosed()
      .subscribe((result: RazaDialogResult | undefined) => {
        if (!result) {
          return;
        }

        this.errorMessage.set(null);
        this.feedbackMessage.set(null);
        this.razasService.update(raza.uuid, result).subscribe({
          next: (response) => this.handleMutationFeedback(response),
          error: () => this.errorMessage.set('No pudimos actualizar la raza.'),
        });
      });
  }

  private confirmActiveToggle(raza: RazaItem) {
    if (this.sensitiveActionsOnlineOnly()) {
      return;
    }

    const nextActive = !raza.activo;
    this.dialog
      .open(ConfirmationDialogComponent, {
        data: {
          title: nextActive ? 'Activar raza' : 'Desactivar raza',
          message: `Vas a ${nextActive ? 'activar' : 'desactivar'} la raza ${raza.nombre}. Los animales existentes conservan su valor histórico.`,
          confirmLabel: nextActive ? 'Activar' : 'Desactivar',
          tone: CONFIRMATION_DIALOG_TONE.WARN,
        },
      })
      .afterClosed()
      .subscribe((confirmed: boolean | undefined) => {
        if (!confirmed) {
          return;
        }

        this.errorMessage.set(null);
        this.feedbackMessage.set(null);
        this.razasService.setActive(raza.uuid, nextActive).subscribe({
          next: (response) => this.handleMutationFeedback(response),
          error: () => this.errorMessage.set('No pudimos actualizar el estado de la raza.'),
        });
      });
  }

  private handleMutationFeedback(response: { message: string; raza?: RazaItem }) {
    this.feedbackMessage.set(response.message);
    if (response.raza) {
      this.rememberRaza(response.raza);
      this.upsertRaza(response.raza);
    }
    this.loadRazas();
  }

  private loadRazas() {
    this.errorMessage.set(null);
    this.loading.set(true);
    this.razasService
      .listAll()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (razas) => {
          const merged = mergeRazasWithRecent(razas, this.recentlySavedRazas());
          this.recentlySavedRazas.set(merged.recent);
          this.razas.set(merged.items);
        },
        error: () => {
          this.razas.set([]);
          this.errorMessage.set('No pudimos cargar las razas.');
        },
      });
  }

  private rememberRaza(raza: RazaItem) {
    this.recentlySavedRazas.update((current) => new Map(current).set(raza.uuid, raza));
  }

  private upsertRaza(raza: RazaItem) {
    this.razas.update((razas) => upsertRazaByUuid(razas, raza));
  }

  private formatDate(value: unknown) {
    return typeof value === 'string' && value.length ? value.slice(0, 10) : '—';
  }
}

function upsertRazaByUuid(razas: readonly RazaItem[], raza: RazaItem): RazaItem[] {
  const index = razas.findIndex((current) => current.uuid === raza.uuid);
  if (index < 0) {
    return [raza, ...razas];
  }

  return razas.map((current, currentIndex) =>
    currentIndex === index ? { ...current, ...raza } : current,
  );
}

function mergeRazasWithRecent(
  razas: readonly RazaItem[],
  recentlySaved: ReadonlyMap<string, RazaItem>,
): { items: RazaItem[]; recent: ReadonlyMap<string, RazaItem> } {
  let items = [...razas];
  const nextRecent = new Map<string, RazaItem>();

  for (const recent of recentlySaved.values()) {
    const current = items.find((raza) => raza.uuid === recent.uuid);
    if (!current) {
      items = [recent, ...items];
      nextRecent.set(recent.uuid, recent);
      continue;
    }

    if (isSameOrNewer(current.updatedAt, recent.updatedAt)) {
      continue;
    }

    items = upsertRazaByUuid(items, recent);
    nextRecent.set(recent.uuid, recent);
  }

  return { items, recent: nextRecent };
}

function isSameOrNewer(candidateUpdatedAt: string, baselineUpdatedAt: string) {
  return candidateUpdatedAt.localeCompare(baselineUpdatedAt) >= 0;
}

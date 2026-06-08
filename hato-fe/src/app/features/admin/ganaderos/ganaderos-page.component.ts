import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { auditTime } from 'rxjs';
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
import {
  GANADERO_DIALOG_MODE,
  GanaderoFormDialogComponent,
  type GanaderoDialogResult,
} from './ganadero-form-dialog.component';
import { GanaderosService, type GanaderoItem } from './data-access/ganaderos.service';

@Component({
  selector: 'app-ganaderos-page',
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, DataTableComponent],
  template: `
    <section class="admin-page">
      <mat-card appearance="outlined" class="status-card">
        @if (offlineMessage()) {
          <p>{{ offlineMessage() }}</p>
        }
        @if (sensitiveActionsOnlineOnly()) {
          <p>La edición y el reseteo de contraseñas de ganaderos requieren conexión.</p>
        }
      </mat-card>

      <div class="toolbar-actions">
        <button mat-flat-button color="primary" type="button" (click)="openCreateDialog()">
          <mat-icon>group_add</mat-icon>
          Registrar ganadero
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
          [data]="ganaderos()"
          [filters]="filters()"
          [actions]="actions"
          [loading]="loading()"
          emptyMessage="Todavía no hay ganaderos registrados."
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
export class GanaderosPageComponent {
  private readonly ganaderosService = inject(GanaderosService);
  private readonly offlineStatus = inject(OfflineStatusService);
  private readonly dialog = inject(MatDialog);
  private readonly destroyRef = inject(DestroyRef);
  private readonly entityChangeBus = inject(OfflineEntityChangeBus);

  readonly ganaderos = signal<GanaderoItem[]>([]);
  readonly errorMessage = signal<string | null>(null);
  readonly feedbackMessage = signal<string | null>(null);
  readonly loading = signal(false);
  readonly offlineMessage = this.offlineStatus.message;
  readonly sensitiveActionsOnlineOnly = computed(() => this.offlineMessage() !== null);
  readonly filters = signal<Record<string, string>>({});
  readonly columns: DataTableColumn[] = [
    {
      key: 'businessIdentifier',
      label: 'Identificador',
      sortable: true,
      filterType: DATA_TABLE_FILTER_TYPE.TEXT,
    },
    { key: 'name', label: 'Nombre', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.TEXT },
    { key: 'email', label: 'Correo', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.TEXT },
    {
      key: 'active',
      label: 'Estado',
      sortable: true,
      filterType: DATA_TABLE_FILTER_TYPE.SELECT,
      filterOptions: [
        { label: 'Activo', value: 'true' },
        { label: 'Baja', value: 'false' },
      ],
      formatter: (value) => (value ? 'Activo' : 'Baja'),
    },
  ];
  readonly actions: DataTableAction[] = [
    { id: 'edit', label: 'Editar', icon: 'edit' },
    { id: 'reset-password', label: 'Reset password', icon: 'lock_reset', color: 'warn' },
    { id: 'toggle-status', label: 'Deshabilitar', icon: 'block', color: 'warn' },
  ];

  constructor() {
    this.loadGanaderos();
    this.entityChangeBus
      .watch(['GANADERO'])
      .pipe(auditTime(50), takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.loadGanaderos());
  }

  openCreateDialog() {
    this.dialog
      .open(GanaderoFormDialogComponent, {
        data: { mode: GANADERO_DIALOG_MODE.CREATE },
      })
      .afterClosed()
      .subscribe((result: GanaderoDialogResult | undefined) => {
        if (!result) {
          return;
        }

        this.feedbackMessage.set(null);
        this.ganaderosService.createGanadero(result).subscribe({
          next: (response) => {
            this.feedbackMessage.set(response.message);
            this.errorMessage.set(response.outcome === 'blocked' ? response.message : null);
            if (response.outcome !== 'blocked') {
              this.loadGanaderos();
            }
          },
          error: () => this.errorMessage.set('No pudimos guardar el ganadero.'),
        });
      });
  }

  handleRowAction(event: DataTableRowActionEvent) {
    const ganadero = event.row as unknown as GanaderoItem;

    if (event.actionId === 'edit') {
      this.openEditDialog(ganadero);
      return;
    }

    if (event.actionId === 'reset-password') {
      this.confirmPasswordReset(ganadero);
      return;
    }

    if (event.actionId === 'toggle-status') {
      this.confirmStatusToggle(ganadero);
    }
  }

  private openEditDialog(ganadero: GanaderoItem) {
    if (this.sensitiveActionsOnlineOnly()) {
      return;
    }

    this.dialog
      .open(GanaderoFormDialogComponent, {
        data: { mode: GANADERO_DIALOG_MODE.EDIT, ganadero },
      })
      .afterClosed()
      .subscribe((result: GanaderoDialogResult | undefined) => {
        if (!result) {
          return;
        }

        this.ganaderosService.updateGanadero(ganadero.id, result).subscribe({
          next: (response) => {
            this.feedbackMessage.set(response.message);
            this.errorMessage.set(response.outcome === 'blocked' ? response.message : null);
            if (response.outcome !== 'blocked') {
              this.loadGanaderos();
            }
          },
          error: () => this.errorMessage.set('No pudimos actualizar el ganadero.'),
        });
      });
  }

  private confirmPasswordReset(ganadero: GanaderoItem) {
    if (this.sensitiveActionsOnlineOnly()) {
      return;
    }

    this.dialog
      .open(ConfirmationDialogComponent, {
        data: {
          title: 'Reset password temporal',
          message: `Vas a resetear la contraseña de ${ganadero.name} (${ganadero.businessIdentifier}) a 112345AB.`,
          confirmLabel: 'Confirmar reset',
          tone: CONFIRMATION_DIALOG_TONE.WARN,
        },
      })
      .afterClosed()
      .subscribe((confirmed: boolean | undefined) => {
        if (!confirmed) {
          return;
        }

        this.ganaderosService.resetPassword(ganadero.id).subscribe({
          next: (response) => {
            this.feedbackMessage.set(response.message);
            this.errorMessage.set(response.outcome === 'blocked' ? response.message : null);
          },
          error: () => this.errorMessage.set('No pudimos resetear la contraseña temporal.'),
        });
      });
  }

  private confirmStatusToggle(ganadero: GanaderoItem) {
    const nextActive = !ganadero.active;

    this.dialog
      .open(ConfirmationDialogComponent, {
        data: {
          title: nextActive ? 'Reactivar ganadero' : 'Dar de baja ganadero',
          message: `Vas a ${nextActive ? 'reactivar' : 'dar de baja'} a ${ganadero.name}.`,
          confirmLabel: nextActive ? 'Reactivar' : 'Confirmar baja',
          tone: CONFIRMATION_DIALOG_TONE.WARN,
        },
      })
      .afterClosed()
      .subscribe((confirmed: boolean | undefined) => {
        if (!confirmed) {
          return;
        }

        this.ganaderosService.updateStatus(ganadero.id, nextActive).subscribe({
          next: (response) => {
            this.feedbackMessage.set(response.message);
            this.loadGanaderos();
          },
          error: () => this.errorMessage.set('No pudimos actualizar el estado del ganadero.'),
        });
      });
  }

  private loadGanaderos() {
    this.errorMessage.set(null);
    this.loading.set(true);

    this.ganaderosService.listGanaderos().subscribe({
      next: (ganaderos) => {
        this.ganaderos.set(ganaderos);
        this.loading.set(false);
      },
      error: () => {
        this.ganaderos.set([]);
        this.errorMessage.set('No pudimos cargar los ganaderos.');
        this.loading.set(false);
      },
    });
  }
}

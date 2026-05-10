import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { finalize } from 'rxjs';
import { OfflineStatusService } from '../../../core/offline/offline-status.service';
import {
  DataTableComponent,
  DATA_TABLE_FILTER_TYPE,
  type DataTableColumn,
  type DataTableRow,
} from '../../../shared/ui/data-table/data-table.component';
import {
  AdminNotificationsService,
  type AdminNotificationRecipientOption,
  type AdminNotificationRecord,
} from './data-access/admin-notifications.service';
import { NotificationFormDialogComponent } from './notification-form-dialog.component';

@Component({
  selector: 'app-admin-notifications-page',
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, DataTableComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="admin-notifications-page">
      <div class="toolbar-actions">
        <button mat-flat-button color="primary" type="button" [disabled]="createSubmitting() || !!offlineMessage()" (click)="openCreateDialog()">
          <mat-icon>add_alert</mat-icon>
          Nueva notificación
        </button>
        @if (offlineMessage()) {
          <p>{{ offlineMessage() }}</p>
        }
      </div>

      <mat-card appearance="outlined" class="table-card">
        <h2>Historial emitido</h2>
        <p class="table-card__hint">Seguimiento operativo de envíos con métricas de lectura por destinatario.</p>
        <app-data-table
          [columns]="historyColumns"
          [data]="historyRows()"
          [filters]="historyFilters()"
          emptyMessage="Todavía no hay notificaciones emitidas."
          (filterChange)="historyFilters.set($event)"
        />
      </mat-card>

      @if (feedbackMessage()) {
        <mat-card appearance="outlined"><p>{{ feedbackMessage() }}</p></mat-card>
      }

      @if (errorMessage()) {
        <mat-card appearance="outlined"><p>{{ errorMessage() }}</p></mat-card>
      }
    </section>
  `,
  styles: [
    `
      .admin-notifications-page {
        display: grid;
        gap: 1rem;
        padding: 1rem;
      }

      .toolbar-actions {
        display: flex;
        justify-content: flex-end;
        align-items: center;
        gap: 1rem;
      }

      .toolbar-actions button {
        border-radius: 999px;
      }

      .toolbar-actions mat-icon {
        margin-inline-end: 0.35rem;
      }

      .toolbar-actions p {
        margin: 0;
      }

      .table-card {
        display: grid;
        gap: 0.75rem;
        padding: 0.75rem;
      }

      .table-card__hint {
        margin: 0;
        color: var(--mat-sys-on-surface-variant);
      }
    `,
  ],
})
export class AdminNotificationsPageComponent {
  private readonly adminNotificationsService = inject(AdminNotificationsService);
  private readonly offlineStatus = inject(OfflineStatusService);
  private readonly dialog = inject(MatDialog);

  readonly offlineMessage = this.offlineStatus.message;
  readonly createSubmitting = signal(false);
  readonly history = signal<AdminNotificationRecord[]>([]);
  readonly recipients = signal<readonly AdminNotificationRecipientOption[]>([]);
  readonly historyFilters = signal<Record<string, string>>({});
  readonly feedbackMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly historyRows = computed(() => this.history().map((notification) => this.toHistoryRow(notification)));

  readonly historyColumns: DataTableColumn[] = [
    { key: 'title', label: 'Título', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.TEXT },
    { key: 'body', label: 'Mensaje', filterType: DATA_TABLE_FILTER_TYPE.TEXT },
    {
      key: 'targetingMode',
      label: 'Destino',
      sortable: true,
      filterType: DATA_TABLE_FILTER_TYPE.SELECT,
      filterOptions: [
        { label: 'Todos activos', value: 'ALL_ACTIVE_GANADEROS' },
        { label: 'Lista explícita', value: 'EXPLICIT_LIST' },
      ],
      formatter: (value) => (value === 'ALL_ACTIVE_GANADEROS' ? 'Todos activos' : 'Lista explícita'),
    },
    { key: 'totalRecipients', label: 'Total destinatarios', sortable: true },
    { key: 'readCount', label: 'Leídas', sortable: true },
    { key: 'pendingCount', label: 'Pendientes', sortable: true },
    { key: 'publishedAt', label: 'Publicada', sortable: true },
  ];

  constructor() {
    this.loadAdminData();
  }

  openCreateDialog() {
    if (this.createSubmitting() || this.offlineMessage()) {
      return;
    }

    this.dialog
      .open(NotificationFormDialogComponent, {
        data: { recipients: this.recipients() },
      })
      .afterClosed()
      .subscribe((result) => {
        if (!result) {
          return;
        }

        this.createSubmitting.set(true);
        this.errorMessage.set(null);
        this.feedbackMessage.set(null);

        this.adminNotificationsService
          .createNotification(result)
          .pipe(finalize(() => this.createSubmitting.set(false)))
          .subscribe({
            next: () => {
              this.feedbackMessage.set('Notificación publicada correctamente.');
              this.loadHistory();
            },
            error: () => this.errorMessage.set('No pudimos publicar la notificación.'),
          });
      });
  }

  private loadAdminData() {
    this.loadHistory();
    this.adminNotificationsService.listActiveGanaderoRecipients().subscribe({
      next: (recipients) => this.recipients.set(recipients),
      error: () => this.errorMessage.set('No pudimos cargar el padrón de destinatarios activos.'),
    });
  }

  private loadHistory() {
    this.adminNotificationsService.listHistory().subscribe({
      next: (history) => this.history.set(history),
      error: () => this.errorMessage.set('No pudimos cargar el historial de notificaciones.'),
    });
  }

  private toHistoryRow(notification: AdminNotificationRecord): DataTableRow {
    const deliveryMetrics = notification.deliveryMetrics ?? {
      totalCount: 0,
      readCount: 0,
      pendingCount: 0,
    };

    return {
      ...notification,
      totalRecipients: deliveryMetrics.totalCount,
      readCount: deliveryMetrics.readCount,
      pendingCount: deliveryMetrics.pendingCount,
    };
  }
}

import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialog } from '@angular/material/dialog';
import { OfflineStatusService } from '../../../core/offline/offline-status.service';
import { ConfirmationDialogComponent, CONFIRMATION_DIALOG_TONE } from '../../../shared/ui/confirmation-dialog/confirmation-dialog.component';
import {
  DataTableComponent,
  DATA_TABLE_FILTER_TYPE,
  type DataTableAction,
  type DataTableColumn,
  type DataTableRowActionEvent,
} from '../../../shared/ui/data-table/data-table.component';
import { AdminUsersService, type ManagedUser } from './data-access/admin-users.service';
import { USER_DIALOG_MODE, UserFormDialogComponent, type UserDialogResult } from './user-form-dialog.component';

@Component({
  selector: 'app-admin-users-page',
  imports: [
    CommonModule,
    MatButtonModule,
    MatCardModule,
    DataTableComponent,
  ],
  template: `
    <section class="admin-page">
      <header class="page-header">
        <h1>Usuarios</h1>
        <p>Alta y gestión mínima de administradores y ganaderos usuario.</p>
      </header>

      <mat-card appearance="outlined">
        <p>Estado de sync: {{ syncSummary() }}</p>
        @if (syncState().syncing) {
          <p>Sincronizando cambios offline…</p>
        }
        @if (offlineMessage()) {
          <p>{{ offlineMessage() }}</p>
        }
        @if (syncState().lastMessage) {
          <p>{{ syncState().lastMessage }}</p>
        }
        @if (sensitiveActionsOnlineOnly()) {
          <p>Las altas, ediciones y resets de contraseñas de usuarios se resuelven solo online.</p>
        }
        @if (syncState().manualRefreshRequired) {
          <p>Necesitás refrescar manualmente la lista para resolver el conflicto remoto.</p>
        }
      </mat-card>

      <div class="toolbar-actions">
        <button mat-flat-button color="primary" type="button" [disabled]="sensitiveActionsOnlineOnly()" (click)="openCreateDialog()">
          Crear usuario
        </button>
      </div>

      @if (feedbackMessage()) {
        <mat-card appearance="outlined" role="status" aria-live="polite"><p>{{ feedbackMessage() }}</p></mat-card>
      }

      @if (errorMessage()) {
        <mat-card appearance="outlined" role="alert" aria-live="assertive"><p>{{ errorMessage() }}</p></mat-card>
      } @else if (!users().length) {
        <mat-card appearance="outlined"><p>Todavía no hay usuarios administrados.</p></mat-card>
      } @else {
        <mat-card appearance="outlined">
          <app-data-table
            [columns]="columns"
            [data]="users()"
            [filters]="filters()"
            [actions]="actions"
            (filterChange)="filters.set($event)"
            (rowAction)="handleRowAction($event)"
          />
        </mat-card>
      }
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
        display: grid;
        gap: 1rem;
      }
    `,
  ],
})
export class AdminUsersPageComponent {
  private readonly adminUsersService = inject(AdminUsersService);
  private readonly offlineStatus = inject(OfflineStatusService);
  private readonly dialog = inject(MatDialog);

  readonly users = signal<ManagedUser[]>([]);
  readonly errorMessage = signal<string | null>(null);
  readonly feedbackMessage = signal<string | null>(null);
  readonly syncState = this.adminUsersService.syncState;
  readonly offlineMessage = this.offlineStatus.message;
  readonly sensitiveActionsOnlineOnly = computed(() => this.offlineMessage() !== null);
  readonly filters = signal<Record<string, string>>({});
  readonly syncSummary = computed(() => {
    const syncState = this.syncState();
    const lastSyncLabel = syncState.lastSyncAt ? ` · Última sync ${syncState.lastSyncAt}` : '';
    return `${syncState.pending} pendiente(s)${lastSyncLabel}`;
  });
  readonly columns: DataTableColumn[] = [
    { key: 'username', label: 'Usuario', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.TEXT },
    { key: 'email', label: 'Correo', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.TEXT },
    {
      key: 'role',
      label: 'Rol',
      sortable: true,
      filterType: DATA_TABLE_FILTER_TYPE.SELECT,
      filterOptions: [
        { label: 'ADMIN', value: 'ADMIN' },
        { label: 'GANADERO', value: 'GANADERO' },
      ],
    },
    {
      key: 'status',
      label: 'Estado',
      sortable: true,
      filterType: DATA_TABLE_FILTER_TYPE.SELECT,
      filterOptions: [
        { label: 'Activo', value: 'ACTIVE' },
        { label: 'Inactivo', value: 'INACTIVE' },
        { label: 'Bloqueado', value: 'BLOCKED' },
      ],
      formatter: (value) => (value === 'ACTIVE' ? 'Activo' : value === 'INACTIVE' ? 'Inactivo' : 'Bloqueado'),
    },
  ];
  readonly actions: DataTableAction[] = [
    { id: 'view', label: 'Ver', icon: 'visibility' },
    { id: 'edit', label: 'Editar', icon: 'edit' },
    { id: 'toggle-status', label: 'Deshabilitar', icon: 'block', color: 'warn' },
  ];

  constructor() {
    this.loadUsers();
  }

  openCreateDialog() {
    if (this.sensitiveActionsOnlineOnly()) {
      return;
    }

    this.dialog
      .open(UserFormDialogComponent, {
        data: { mode: USER_DIALOG_MODE.CREATE },
      })
      .afterClosed()
      .subscribe((result: UserDialogResult | undefined) => {
        if (!result) {
          return;
        }

        this.feedbackMessage.set(null);
        this.adminUsersService.createUser({ ...result, password: result.password ?? '' }).subscribe({
          next: (response) => {
            this.errorMessage.set(response.outcome === 'blocked' ? response.message : null);
            if (response.outcome !== 'blocked') {
              this.feedbackMessage.set(response.message);
              this.loadUsers();
            }
          },
          error: () => this.errorMessage.set('No pudimos guardar el usuario.'),
        });
      });
  }

  handleRowAction(event: DataTableRowActionEvent) {
    const user = event.row as unknown as ManagedUser;

    if (event.actionId === 'view') {
      this.dialog.open(UserFormDialogComponent, {
        data: { mode: USER_DIALOG_MODE.VIEW, user },
      });
      return;
    }

    if (event.actionId === 'edit') {
      this.openEditDialog(user);
      return;
    }

    if (event.actionId === 'toggle-status') {
      this.confirmStatusToggle(user);
    }
  }

  private openEditDialog(user: ManagedUser) {
    if (this.sensitiveActionsOnlineOnly()) {
      return;
    }

    this.dialog
      .open(UserFormDialogComponent, {
        data: { mode: USER_DIALOG_MODE.EDIT, user },
      })
      .afterClosed()
      .subscribe((result: UserDialogResult | undefined) => {
        if (!result) {
          return;
        }

        this.adminUsersService.updateUser(user.id, result).subscribe({
          next: (response) => {
            this.errorMessage.set(response.outcome === 'blocked' ? response.message : null);
            if (response.outcome !== 'blocked') {
              this.feedbackMessage.set(response.message);
              this.loadUsers();
            }
          },
          error: () => this.errorMessage.set('No pudimos actualizar el usuario.'),
        });
      });
  }

  private confirmStatusToggle(user: ManagedUser) {
    const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    this.dialog
      .open(ConfirmationDialogComponent, {
        data: {
          title: nextStatus === 'INACTIVE' ? 'Deshabilitar usuario' : 'Reactivar usuario',
          message: `Vas a ${nextStatus === 'INACTIVE' ? 'deshabilitar' : 'reactivar'} a ${user.displayName}.`,
          confirmLabel: nextStatus === 'INACTIVE' ? 'Deshabilitar' : 'Reactivar',
          tone: CONFIRMATION_DIALOG_TONE.WARN,
        },
      })
      .afterClosed()
      .subscribe((confirmed: boolean | undefined) => {
        if (!confirmed) {
          return;
        }

        this.feedbackMessage.set(null);
        this.adminUsersService.updateStatus(user.id, nextStatus).subscribe({
          next: (result) => {
            this.feedbackMessage.set(result.message);
            this.loadUsers();
          },
          error: () => this.errorMessage.set('No pudimos actualizar el estado del usuario.'),
        });
      });
  }

  private loadUsers() {
    this.errorMessage.set(null);
    this.adminUsersService.listUsers().subscribe({
      next: (users) => this.users.set(users),
      error: () => {
        this.users.set([]);
        this.errorMessage.set('No pudimos cargar los usuarios.');
      },
    });
  }
}

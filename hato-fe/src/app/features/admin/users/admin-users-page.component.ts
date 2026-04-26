import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';
import { PASSWORD_POLICY_MESSAGE, passwordPolicyValidators } from '../../../shared/forms/password-policy';
import { FormErrorsComponent } from '../../../shared/ui/form-errors/form-errors.component';
import { AdminUsersService, type ManagedUser } from './data-access/admin-users.service';
import { OfflineStatusService } from '../../../core/offline/offline-status.service';

@Component({
  selector: 'app-admin-users-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    FormErrorsComponent,
  ],
  template: `
    <section class="admin-page">
      <header class="page-header">
        <h1>Usuarios</h1>
        <p>Alta y gestión mínima de administradores y ganaderos usuario.</p>
      </header>

      <mat-card appearance="outlined">
        <p>Estado de sync: {{ syncSummary() }}</p>
        @if (offlineMessage()) {
          <p>{{ offlineMessage() }}</p>
        }
        @if (sensitiveActionsOnlineOnly()) {
          <p>Las altas de usuarios y resets de contraseña se resuelven solo online.</p>
        }
        @if (syncState().manualRefreshRequired) {
          <p>Necesitás refrescar manualmente la lista para resolver el conflicto remoto.</p>
        }
      </mat-card>

      <mat-card appearance="outlined">
        <form [formGroup]="createForm" class="form-grid" (ngSubmit)="submitCreate()">
          <mat-form-field appearance="outline">
            <mat-label>Usuario *</mat-label>
            <input matInput formControlName="username" required />
            <mat-hint>Definí un identificador único para ingreso y trazabilidad.</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Correo *</mat-label>
            <input matInput type="email" formControlName="email" required />
            <mat-hint>Se usa para contacto, recuperación y auditoría.</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Nombre visible *</mat-label>
            <input matInput formControlName="displayName" required />
            <mat-hint>Es el nombre que ve el equipo dentro del panel.</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Rol *</mat-label>
            <mat-select formControlName="role" required>
              <mat-option value="ADMIN">ADMIN</mat-option>
              <mat-option value="GANADERO">GANADERO</mat-option>
            </mat-select>
            <mat-hint>Solo existen roles ADMIN y GANADERO.</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Contraseña *</mat-label>
            <input matInput type="password" formControlName="password" autocomplete="new-password" required />
            <mat-hint>Mínimo 8 caracteres, 1 mayúscula y 1 número.</mat-hint>
          </mat-form-field>

          <app-form-errors [control]="createForm.controls.username" [messages]="messages.username" />
          <app-form-errors [control]="createForm.controls.email" [messages]="messages.email" />
          <app-form-errors [control]="createForm.controls.displayName" [messages]="messages.displayName" />
          <app-form-errors [control]="createForm.controls.password" [messages]="messages.password" />

          <button
            mat-flat-button
            color="primary"
            type="submit"
            [disabled]="createForm.invalid || createSubmitting() || sensitiveActionsOnlineOnly()"
          >
            {{ createSubmitting() ? 'Guardando…' : 'Crear usuario' }}
          </button>
        </form>
      </mat-card>

      <mat-card appearance="outlined">
        <form [formGroup]="passwordForm" class="form-grid" (ngSubmit)="submitPasswordReset()">
          <mat-form-field appearance="outline">
            <mat-label>Usuario a resetear *</mat-label>
            <mat-select formControlName="userId" required>
              @for (user of users(); track user.id) {
                <mat-option [value]="user.id">{{ user.displayName }} ({{ user.role }})</mat-option>
              }
            </mat-select>
            <mat-hint>Elegí la cuenta que necesita una nueva contraseña.</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Nueva contraseña *</mat-label>
            <input matInput type="password" formControlName="password" autocomplete="new-password" required />
            <mat-hint>Mantené la política: 8 caracteres, 1 mayúscula y 1 número.</mat-hint>
          </mat-form-field>

          <app-form-errors [control]="passwordForm.controls.userId" [messages]="passwordMessages.userId" />
          <app-form-errors
            [control]="passwordForm.controls.password"
            [messages]="passwordMessages.password"
          />

          <button
            mat-stroked-button
            color="primary"
            type="submit"
            [disabled]="passwordForm.invalid || passwordSubmitting() || sensitiveActionsOnlineOnly()"
          >
            {{ passwordSubmitting() ? 'Actualizando…' : 'Resetear contraseña' }}
          </button>
        </form>
      </mat-card>

      @if (feedbackMessage()) {
        <mat-card appearance="outlined" role="status" aria-live="polite"><p>{{ feedbackMessage() }}</p></mat-card>
      }

      @if (errorMessage()) {
        <mat-card appearance="outlined" role="alert" aria-live="assertive"><p>{{ errorMessage() }}</p></mat-card>
      } @else if (!users().length) {
        <mat-card appearance="outlined"><p>Todavía no hay usuarios administrados.</p></mat-card>
      } @else {
        <div class="cards-grid">
          @for (user of users(); track user.id) {
            <mat-card appearance="outlined">
              <h2>{{ user.displayName }}</h2>
                <p>{{ user.username }} · {{ user.role }}</p>
                <p>Estado: {{ user.status }}</p>
                <div class="actions">
                  <button
                    mat-button
                    type="button"
                    [disabled]="updatingStatusIds().includes(user.id)"
                    (click)="toggleStatus(user)"
                  >
                    {{ user.status === 'ACTIVE' ? 'Dar de baja' : 'Reactivar' }}
                  </button>
                </div>
            </mat-card>
          }
        </div>
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

      .form-grid,
      .cards-grid {
        display: grid;
        gap: 1rem;
      }

      .cards-grid {
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
      }
    `,
  ],
})
export class AdminUsersPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly adminUsersService = inject(AdminUsersService);
  private readonly offlineStatus = inject(OfflineStatusService);

  readonly users = signal<ManagedUser[]>([]);
  readonly errorMessage = signal<string | null>(null);
  readonly feedbackMessage = signal<string | null>(null);
  readonly createSubmitting = signal(false);
  readonly passwordSubmitting = signal(false);
  readonly updatingStatusIds = signal<string[]>([]);
  readonly syncState = this.adminUsersService.syncState;
  readonly offlineMessage = this.offlineStatus.message;
  readonly sensitiveActionsOnlineOnly = computed(() => this.offlineMessage() !== null);
  readonly syncSummary = computed(() => {
    const syncState = this.syncState();
    const lastSyncLabel = syncState.lastSyncAt ? ` · Última sync ${syncState.lastSyncAt}` : '';
    return `${syncState.pending} pendiente(s)${lastSyncLabel}`;
  });
  readonly createForm = this.formBuilder.nonNullable.group({
    username: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    displayName: ['', [Validators.required]],
    role: ['ADMIN' as const, [Validators.required]],
    password: ['', passwordPolicyValidators],
  });
  readonly passwordForm = this.formBuilder.nonNullable.group({
    userId: ['', [Validators.required]],
    password: ['', passwordPolicyValidators],
  });

  readonly messages = {
    username: { required: 'Ingresá un usuario.' },
    email: { required: 'Ingresá un correo válido.', email: 'Ingresá un correo válido.' },
    displayName: { required: 'Ingresá un nombre visible.' },
    password: {
      required: 'Ingresá una contraseña segura.',
      minlength: PASSWORD_POLICY_MESSAGE,
      pattern: PASSWORD_POLICY_MESSAGE,
    },
  };
  readonly passwordMessages = {
    userId: { required: 'Seleccioná el usuario a resetear.' },
    password: {
      required: 'Ingresá una nueva contraseña segura.',
      minlength: PASSWORD_POLICY_MESSAGE,
      pattern: PASSWORD_POLICY_MESSAGE,
    },
  };

  constructor() {
    this.loadUsers();
  }

  submitCreate() {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.feedbackMessage.set(null);
    this.createSubmitting.set(true);

    this.adminUsersService.createUser(this.createForm.getRawValue()).pipe(finalize(() => this.createSubmitting.set(false))).subscribe({
      next: (result) => {
        if (result.outcome === 'blocked') {
          this.errorMessage.set(result.message);
          return;
        }

        this.createForm.reset({ role: 'ADMIN', username: '', email: '', displayName: '', password: '' });
        this.errorMessage.set(null);
        this.feedbackMessage.set(result.message);
        this.loadUsers();
      },
      error: () => this.errorMessage.set('No pudimos guardar el usuario.'),
    });
  }

  submitPasswordReset() {
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const { userId, password } = this.passwordForm.getRawValue();
    this.feedbackMessage.set(null);
    this.passwordSubmitting.set(true);

    this.adminUsersService.resetPassword(userId, password).pipe(finalize(() => this.passwordSubmitting.set(false))).subscribe({
      next: (result) => {
        if (result.outcome === 'blocked') {
          this.errorMessage.set(result.message);
          return;
        }

        this.passwordForm.reset({ userId: '', password: '' });
        this.errorMessage.set(null);
        this.feedbackMessage.set(result.message);
      },
      error: () => this.errorMessage.set('No pudimos resetear la contraseña.'),
    });
  }

  toggleStatus(user: ManagedUser) {
    const nextStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    this.feedbackMessage.set(null);
    this.updatingStatusIds.update((ids) => [...ids, user.id]);

    this.adminUsersService.updateStatus(user.id, nextStatus).pipe(
      finalize(() => this.updatingStatusIds.update((ids) => ids.filter((id) => id !== user.id)))
    ).subscribe({
      next: (result) => {
        this.feedbackMessage.set(result.message);
        this.loadUsers();
      },
      error: () => this.errorMessage.set('No pudimos actualizar el estado del usuario.'),
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

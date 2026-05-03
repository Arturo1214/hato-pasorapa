import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { PASSWORD_POLICY_MESSAGE, passwordPolicyValidators } from '../../../shared/forms/password-policy';
import { FormErrorsComponent } from '../../../shared/ui/form-errors/form-errors.component';
import type { Role } from '../../../core/auth/data-access/auth.service';
import type { ManagedUser } from './data-access/admin-users.service';

export const USER_DIALOG_MODE = {
  CREATE: 'create',
  EDIT: 'edit',
  VIEW: 'view',
} as const;

export type UserDialogMode = (typeof USER_DIALOG_MODE)[keyof typeof USER_DIALOG_MODE];

export interface UserDialogData {
  mode: UserDialogMode;
  user?: ManagedUser;
}

export interface UserDialogResult {
  displayName: string;
  email: string;
  password?: string;
  role: Role;
  username: string;
}

@Component({
  selector: 'app-user-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    FormErrorsComponent,
  ],
  template: `
    <h2 mat-dialog-title>{{ title() }}</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline">
          <mat-label>Usuario</mat-label>
          <input matInput formControlName="username" [readonly]="readOnly()" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Correo</mat-label>
          <input matInput type="email" formControlName="email" [readonly]="readOnly()" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Nombre visible</mat-label>
          <input matInput formControlName="displayName" [readonly]="readOnly()" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Rol</mat-label>
          <mat-select formControlName="role" [disabled]="readOnly()">
            <mat-option value="ADMIN">ADMIN</mat-option>
            <mat-option value="GANADERO">GANADERO</mat-option>
          </mat-select>
        </mat-form-field>

        @if (showPasswordField()) {
          <mat-form-field appearance="outline">
            <mat-label>Contraseña</mat-label>
            <input matInput type="password" formControlName="password" autocomplete="new-password" />
          </mat-form-field>
        }

        <app-form-errors [control]="form.controls.username" [messages]="messages.username" />
        <app-form-errors [control]="form.controls.email" [messages]="messages.email" />
        <app-form-errors [control]="form.controls.displayName" [messages]="messages.displayName" />
        @if (showPasswordField()) {
          <app-form-errors [control]="form.controls.password" [messages]="messages.password" />
        }
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Cerrar</button>
      @if (!readOnly()) {
        <button mat-flat-button color="primary" type="button" [disabled]="form.invalid" (click)="submit()">
          {{ submitLabel() }}
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dialog-form {
        display: grid;
        gap: 1rem;
        min-width: min(32rem, 80vw);
        padding-top: 0.5rem;
      }
    `,
  ],
})
export class UserFormDialogComponent {
  readonly data = inject<UserDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<UserFormDialogComponent, UserDialogResult | undefined>);
  private readonly formBuilder = inject(FormBuilder);

  readonly readOnly = computed(() => this.data.mode === USER_DIALOG_MODE.VIEW);
  readonly showPasswordField = computed(() => this.data.mode === USER_DIALOG_MODE.CREATE);
  readonly title = computed(() => {
    if (this.data.mode === USER_DIALOG_MODE.CREATE) {
      return 'Crear usuario';
    }

    if (this.data.mode === USER_DIALOG_MODE.EDIT) {
      return 'Editar usuario';
    }

    return 'Detalle del usuario';
  });
  readonly submitLabel = computed(() => (this.data.mode === USER_DIALOG_MODE.CREATE ? 'Crear' : 'Guardar cambios'));

  readonly form = this.formBuilder.nonNullable.group({
    username: [this.data.user?.username ?? '', [Validators.required]],
    email: [this.data.user?.email ?? '', [Validators.required, Validators.email]],
    displayName: [this.data.user?.displayName ?? '', [Validators.required]],
    role: [(this.data.user?.role ?? 'ADMIN') as Role, [Validators.required]],
    password: [this.data.mode === USER_DIALOG_MODE.CREATE ? '' : 'Password123', this.data.mode === USER_DIALOG_MODE.CREATE ? passwordPolicyValidators : []],
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

  constructor() {
    if (this.readOnly()) {
      this.form.disable();
    }
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const { password, ...rawValue } = this.form.getRawValue();
    this.dialogRef.close(this.showPasswordField() ? { ...rawValue, password } : rawValue);
  }
}

import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import type {
  AdminNotificationCreatePayload,
  AdminNotificationRecipientOption,
  AdminNotificationTargetingMode,
} from './data-access/admin-notifications.service';

export interface NotificationFormDialogData {
  recipients: readonly AdminNotificationRecipientOption[];
}

@Component({
  selector: 'app-notification-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
  ],
  template: `
    <h2 mat-dialog-title>Nueva notificación</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline">
          <mat-label>Título *</mat-label>
          <input matInput formControlName="title" required />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Mensaje *</mat-label>
          <textarea matInput rows="4" formControlName="body" required></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Targeting *</mat-label>
          <mat-select formControlName="targetingMode">
            <mat-option value="ALL_ACTIVE_GANADEROS">Todos los GANADERO activos</mat-option>
            <mat-option value="EXPLICIT_LIST">Lista explícita</mat-option>
          </mat-select>
        </mat-form-field>

        @if (explicitListSelected()) {
          <mat-form-field appearance="outline">
            <mat-label>Destinatarios explícitos</mat-label>
            <mat-select formControlName="includeUserIds" multiple>
              @for (recipient of data.recipients; track recipient.id) {
                <mat-option [value]="recipient.id">{{ recipient.displayName }} · {{ recipient.username }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        }

        <mat-form-field appearance="outline">
          <mat-label>Excluir destinatarios</mat-label>
          <mat-select formControlName="excludeUserIds" multiple>
            @for (recipient of data.recipients; track recipient.id) {
              <mat-option [value]="recipient.id">{{ recipient.displayName }} · {{ recipient.username }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (explicitListSelected() && includeUserIdsInvalid()) {
          <p class="form-alert" role="alert">Seleccioná al menos un destinatario explícito.</p>
        }
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Cancelar</button>
      <button mat-flat-button color="primary" type="button" [disabled]="form.invalid" (click)="submit()">
        Publicar notificación
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dialog-form {
        display: grid;
        gap: 1rem;
        min-width: min(34rem, 82vw);
        padding-top: 0.5rem;
      }

      .form-alert {
        margin: 0;
        color: var(--mat-sys-error);
        font-weight: 600;
      }
    `,
  ],
})
export class NotificationFormDialogComponent {
  readonly data = inject<NotificationFormDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<NotificationFormDialogComponent, AdminNotificationCreatePayload | undefined>);
  private readonly formBuilder = inject(FormBuilder);

  readonly form = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    body: ['', [Validators.required, Validators.maxLength(2000)]],
    targetingMode: this.formBuilder.nonNullable.control<AdminNotificationTargetingMode>('ALL_ACTIVE_GANADEROS', {
      validators: [Validators.required],
    }),
    includeUserIds: [[] as string[]],
    excludeUserIds: [[] as string[]],
  });

  explicitListSelected() {
    return this.form.controls.targetingMode.value === 'EXPLICIT_LIST';
  }

  includeUserIdsInvalid() {
    return this.form.controls.includeUserIds.touched && !this.form.controls.includeUserIds.value.length;
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.explicitListSelected() && !this.form.controls.includeUserIds.value.length) {
      this.form.controls.includeUserIds.markAsTouched();
      return;
    }

    this.dialogRef.close(this.form.getRawValue());
  }
}

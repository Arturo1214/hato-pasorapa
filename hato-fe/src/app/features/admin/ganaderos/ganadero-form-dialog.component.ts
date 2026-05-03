import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormErrorsComponent } from '../../../shared/ui/form-errors/form-errors.component';
import type { GanaderoItem } from './data-access/ganaderos.service';

export const GANADERO_DIALOG_MODE = {
  CREATE: 'create',
  EDIT: 'edit',
} as const;

export type GanaderoDialogMode = (typeof GANADERO_DIALOG_MODE)[keyof typeof GANADERO_DIALOG_MODE];

export interface GanaderoDialogData {
  ganadero?: GanaderoItem;
  mode: GanaderoDialogMode;
}

export interface GanaderoDialogResult {
  businessIdentifier: string;
  contactInfo: string;
  email: string;
  name: string;
}

@Component({
  selector: 'app-ganadero-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    FormErrorsComponent,
  ],
  template: `
    <h2 mat-dialog-title>{{ title() }}</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline">
          <mat-label>Identificador</mat-label>
          <input matInput formControlName="businessIdentifier" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="name" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Correo</mat-label>
          <input matInput type="email" formControlName="email" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Contacto</mat-label>
          <textarea matInput rows="4" formControlName="contactInfo"></textarea>
        </mat-form-field>

        <app-form-errors [control]="form.controls.businessIdentifier" [messages]="messages.businessIdentifier" />
        <app-form-errors [control]="form.controls.name" [messages]="messages.name" />
        <app-form-errors [control]="form.controls.email" [messages]="messages.email" />
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Cancelar</button>
      <button mat-flat-button color="primary" type="button" [disabled]="form.invalid" (click)="submit()">
        {{ submitLabel() }}
      </button>
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
export class GanaderoFormDialogComponent {
  readonly data = inject<GanaderoDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<GanaderoFormDialogComponent, GanaderoDialogResult | undefined>);
  private readonly formBuilder = inject(FormBuilder);

  readonly title = computed(() => (this.data.mode === GANADERO_DIALOG_MODE.CREATE ? 'Registrar ganadero' : 'Editar ganadero'));
  readonly submitLabel = computed(() => (this.data.mode === GANADERO_DIALOG_MODE.CREATE ? 'Registrar' : 'Guardar cambios'));

  readonly form = this.formBuilder.nonNullable.group({
    businessIdentifier: [this.data.ganadero?.businessIdentifier ?? '', [Validators.required]],
    name: [this.data.ganadero?.name ?? '', [Validators.required]],
    email: [this.data.ganadero?.email ?? '', [Validators.email]],
    contactInfo: [this.data.ganadero?.contactInfo ?? ''],
  });

  readonly messages = {
    businessIdentifier: { required: 'Ingresá el identificador de negocio.' },
    name: { required: 'Ingresá el nombre del ganadero.' },
    email: { email: 'Ingresá un correo válido.' },
  };

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.dialogRef.close(this.form.getRawValue());
  }
}

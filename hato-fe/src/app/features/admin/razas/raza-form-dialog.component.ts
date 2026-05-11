import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormErrorsComponent } from '../../../shared/ui/form-errors/form-errors.component';
import type { RazaItem, RazaTipo } from './models/raza.model';

export const RAZA_DIALOG_MODE = {
  CREATE: 'create',
  EDIT: 'edit',
} as const;

export type RazaDialogMode = (typeof RAZA_DIALOG_MODE)[keyof typeof RAZA_DIALOG_MODE];

export interface RazaDialogData {
  mode: RazaDialogMode;
  raza?: RazaItem;
}

export interface RazaDialogResult {
  nombre: string;
  descripcion: string | null;
  origen: string | null;
  sortOrder: number | null;
  tipo: RazaTipo;
  activo: boolean;
}

@Component({
  selector: 'app-raza-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    FormErrorsComponent,
  ],
  template: `
    <h2 mat-dialog-title>{{ title() }}</h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline">
          <mat-label>Nombre</mat-label>
          <input matInput formControlName="nombre" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Descripción</mat-label>
          <textarea matInput rows="4" formControlName="descripcion"></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Origen</mat-label>
          <input matInput formControlName="origen" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Orden</mat-label>
          <input matInput type="number" formControlName="sortOrder" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Tipo</mat-label>
          <mat-select formControlName="tipo">
            <mat-option value="UNCLASSIFIED">Sin clasificar</mat-option>
            <mat-option value="BEEF">Carne</mat-option>
            <mat-option value="DAIRY">Leche</mat-option>
            <mat-option value="DUAL_PURPOSE">Doble propósito</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-checkbox formControlName="activo">Raza activa</mat-checkbox>

        <app-form-errors [control]="form.controls.nombre" [messages]="messages.nombre" />
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
        min-width: min(34rem, 82vw);
        padding-top: 0.5rem;
      }
    `,
  ],
})
export class RazaFormDialogComponent {
  readonly data = inject<RazaDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<RazaFormDialogComponent, RazaDialogResult | undefined>);
  private readonly formBuilder = inject(FormBuilder);

  readonly title = computed(() => (this.data.mode === RAZA_DIALOG_MODE.CREATE ? 'Nueva raza' : 'Editar raza'));
  readonly submitLabel = computed(() => (this.data.mode === RAZA_DIALOG_MODE.CREATE ? 'Crear raza' : 'Guardar cambios'));

  readonly form = this.formBuilder.nonNullable.group({
    nombre: [this.data.raza?.nombre ?? '', [Validators.required, Validators.maxLength(120)]],
    descripcion: [this.data.raza?.descripcion ?? '', [Validators.maxLength(500)]],
    origen: [this.data.raza?.origen ?? '', [Validators.maxLength(120)]],
    sortOrder: this.formBuilder.control<number | null>(this.data.raza?.sortOrder ?? null),
    tipo: this.formBuilder.nonNullable.control<RazaTipo>(this.data.raza?.tipo ?? 'UNCLASSIFIED', {
      validators: [Validators.required],
    }),
    activo: [this.data.raza?.activo ?? true],
  });

  readonly messages = {
    nombre: {
      required: 'Ingresá el nombre de la raza.',
      maxlength: 'El nombre no puede superar 120 caracteres.',
    },
  };

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.dialogRef.close({
      nombre: value.nombre.trim(),
      descripcion: this.cleanOptional(value.descripcion),
      origen: this.cleanOptional(value.origen),
      sortOrder: value.sortOrder,
      tipo: value.tipo,
      activo: value.activo,
    });
  }

  private cleanOptional(value: string) {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
}

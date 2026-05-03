import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, type AbstractControl, type ValidationErrors, type ValidatorFn } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormErrorsComponent } from '../../../shared/ui/form-errors/form-errors.component';
import {
  ANIMAL_CATEGORY,
  ANIMAL_CATEGORY_OPTIONS,
  ANIMAL_SEX,
  ANIMAL_SEX_OPTIONS,
  inferAnimalSexFromCategory,
  type AnimalItem,
  type AnimalMutationPayload,
} from './data-access/animals.service';

export const ANIMAL_DIALOG_MODE = {
  CREATE: 'create',
  EDIT: 'edit',
} as const;

export type AnimalDialogMode = (typeof ANIMAL_DIALOG_MODE)[keyof typeof ANIMAL_DIALOG_MODE];

export interface AnimalDialogData {
  mode: AnimalDialogMode;
  animal?: AnimalItem;
}

export type AnimalDialogResult = AnimalMutationPayload;

@Component({
  selector: 'app-animal-form-dialog',
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
          <mat-label>UUID del ganadero dueño</mat-label>
          <input matInput formControlName="ownerGanaderoId" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Arete</mat-label>
          <input matInput formControlName="arete" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Marca</mat-label>
          <input matInput formControlName="marca" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Tatuaje</mat-label>
          <input matInput formControlName="tatuaje" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Categoría</mat-label>
          <mat-select formControlName="category">
            @for (option of categoryOptions; track option.value) {
              <mat-option [value]="option.value">{{ option.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Sexo</mat-label>
          <mat-select formControlName="sex">
            @for (option of sexOptions; track option.value) {
              <mat-option [value]="option.value">{{ option.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Fecha de nacimiento</mat-label>
          <input matInput type="date" formControlName="birthDate" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Fecha de ingreso</mat-label>
          <input matInput type="date" formControlName="admissionDate" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Estado</mat-label>
          <mat-select formControlName="active">
            <mat-option [value]="true">Activo</mat-option>
            <mat-option [value]="false">Inactivo</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Peso (kg)</mat-label>
          <input matInput type="number" min="0" formControlName="weightKg" />
        </mat-form-field>

        <app-form-errors [control]="form.controls.ownerGanaderoId" [messages]="messages.ownerGanaderoId" />
        <app-form-errors [control]="form.controls.category" [messages]="messages.category" />
        <app-form-errors [control]="form.controls.sex" [messages]="messages.sex" />
        <app-form-errors [control]="form.controls.admissionDate" [messages]="messages.admissionDate" />
        <app-form-errors [control]="form.controls.weightKg" [messages]="messages.weightKg" />

        @if (showVisibleIdentifiersError()) {
          <div class="form-alert" role="alert">Indicá al menos un identificador visible: arete, marca o tatuaje.</div>
        }

        @if (showCategorySexError()) {
          <div class="form-alert" role="alert">La categoría seleccionada no es compatible con el sexo informado.</div>
        }

        @if (showBirthDateError()) {
          <div class="form-alert" role="alert">Ingresá la fecha de nacimiento para terneros/as.</div>
        }
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
        min-width: min(42rem, 85vw);
        padding-top: 0.5rem;
      }

      .form-alert {
        color: #b3261e;
        font-weight: 500;
      }
    `,
  ],
})
export class AnimalFormDialogComponent {
  readonly data = inject<AnimalDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<AnimalFormDialogComponent, AnimalDialogResult | undefined>);
  private readonly formBuilder = inject(FormBuilder);

  readonly categoryOptions = ANIMAL_CATEGORY_OPTIONS;
  readonly sexOptions = ANIMAL_SEX_OPTIONS;
  readonly title = computed(() => (this.data.mode === ANIMAL_DIALOG_MODE.CREATE ? 'Nuevo animal' : 'Editar animal'));
  readonly submitLabel = computed(() => (this.data.mode === ANIMAL_DIALOG_MODE.CREATE ? 'Guardar animal' : 'Guardar cambios'));
  readonly form = this.formBuilder.group(
    {
      ownerGanaderoId: [this.data.animal?.ownerGanaderoId ?? '', [Validators.required]],
      arete: [this.data.animal?.arete ?? ''],
      marca: [this.data.animal?.marca ?? ''],
      tatuaje: [this.data.animal?.tatuaje ?? ''],
      category: [this.data.animal?.category ?? ANIMAL_CATEGORY.VACA, [Validators.required]],
      sex: [this.data.animal?.sex ?? inferAnimalSexFromCategory(this.data.animal?.category ?? ANIMAL_CATEGORY.VACA), [Validators.required]],
      active: [this.data.animal?.active ?? true, [Validators.required]],
      birthDate: [this.data.animal?.birthDate ?? ''],
      admissionDate: [this.data.animal?.admissionDate ?? '', [Validators.required]],
      weightKg: [this.data.animal?.weightKg ?? null, [Validators.min(0)]],
    },
    {
      validators: [visibleIdentifierValidator, categorySexValidator, birthDateRequiredForYoungAnimalsValidator],
    },
  );

  readonly messages = {
    ownerGanaderoId: { required: 'Informá el UUID del ganadero responsable.' },
    category: { required: 'Seleccioná la categoría actual del animal.' },
    sex: { required: 'Seleccioná el sexo del animal.' },
    admissionDate: { required: 'Ingresá la fecha de ingreso vigente.' },
    weightKg: { min: 'El peso no puede ser negativo.' },
  };

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.form.updateValueAndValidity();
      return;
    }

    const value = this.form.getRawValue();
    this.dialogRef.close({
      ownerGanaderoId: value.ownerGanaderoId?.trim() ?? '',
      arete: normalizeOptionalText(value.arete),
      marca: normalizeOptionalText(value.marca),
      tatuaje: normalizeOptionalText(value.tatuaje),
      category: value.category ?? ANIMAL_CATEGORY.VACA,
      sex: value.sex ?? inferAnimalSexFromCategory(value.category ?? ANIMAL_CATEGORY.VACA),
      active: Boolean(value.active),
      birthDate: normalizeOptionalText(value.birthDate),
      admissionDate: value.admissionDate ?? '',
      weightKg: normalizeWeight(value.weightKg),
    });
  }

  showVisibleIdentifiersError() {
    return this.form.touched && this.form.hasError('visibleIdentifierRequired');
  }

  showCategorySexError() {
    return this.form.touched && this.form.hasError('categorySexMismatch');
  }

  showBirthDateError() {
    return this.form.touched && this.form.hasError('birthDateRequiredForYoungAnimal');
  }
}

const visibleIdentifierValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as { arete?: string | null; marca?: string | null; tatuaje?: string | null };
  return normalizeOptionalText(value.arete) || normalizeOptionalText(value.marca) || normalizeOptionalText(value.tatuaje)
    ? null
    : { visibleIdentifierRequired: true };
};

const categorySexValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as { category?: string | null; sex?: string | null };
  if (!value.category || !value.sex) {
    return null;
  }

  const valid = value.sex === ANIMAL_SEX.HEMBRA
    ? value.category === ANIMAL_CATEGORY.TERNERA || value.category === ANIMAL_CATEGORY.VAQUILLONA || value.category === ANIMAL_CATEGORY.VACA
    : value.category === ANIMAL_CATEGORY.TERNERO || value.category === ANIMAL_CATEGORY.TORO || value.category === ANIMAL_CATEGORY.BUEY;

  return valid ? null : { categorySexMismatch: true };
};

const birthDateRequiredForYoungAnimalsValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as { category?: string | null; birthDate?: string | null };
  const requiresBirthDate = value.category === ANIMAL_CATEGORY.TERNERO || value.category === ANIMAL_CATEGORY.TERNERA;
  return !requiresBirthDate || normalizeOptionalText(value.birthDate) ? null : { birthDateRequiredForYoungAnimal: true };
};

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeWeight(value: number | string | null | undefined) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  return typeof value === 'number' ? value : Number(value);
}

import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, type AbstractControl, type ValidationErrors, type ValidatorFn } from '@angular/forms';
import { MatAutocompleteModule, type MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { FormErrorsComponent } from '../../../shared/ui/form-errors/form-errors.component';
import { AnimalsService, type AnimalItem } from '../animals/data-access/animals.service';

export type VetVisitDialogMode = 'GLOBAL' | 'SPECIFIC';
export type VetVisitDialogStatus = 'PENDING' | 'ATTENDED' | 'RESCHEDULED' | 'FINALIZED' | 'CANCELED';

export interface VetVisitDialogData {
  mode?: VetVisitDialogMode;
  parentVisitId?: string | null;
  targetAnimalCount?: number | null;
}

export interface VetVisitDialogResult {
  mode: VetVisitDialogMode;
  animalUuid: string | null;
  visitId: string;
  status: VetVisitDialogStatus;
  occurredAt: string;
  nextDueAt: string | null;
  notes: string | null;
  reason: string;
  findings: string;
  plan: string;
  veterinarianName: string;
  veterinarianLicense: string | null;
  targetAnimalCount: number | null;
  parentVisitId: string | null;
}

@Component({
  selector: 'app-vet-visit-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    FormErrorsComponent,
  ],
  template: `
    <h2 mat-dialog-title>Nueva visita veterinaria</h2>

    <mat-dialog-content class="dialog-content">
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline">
          <mat-label>Modo</mat-label>
          <mat-select formControlName="mode">
            <mat-option value="GLOBAL">Global / Campaña</mat-option>
            <mat-option value="SPECIFIC">Específica</mat-option>
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Estado</mat-label>
          <mat-select formControlName="status">
            <mat-option value="PENDING">Programada</mat-option>
            <mat-option value="ATTENDED">Atendida</mat-option>
            <mat-option value="RESCHEDULED">Reprogramada</mat-option>
            <mat-option value="FINALIZED">Finalizada</mat-option>
            <mat-option value="CANCELED">Cancelada</mat-option>
          </mat-select>
        </mat-form-field>

        @if (form.controls.mode.value === 'SPECIFIC') {
          <mat-form-field appearance="outline" class="form-field--full">
            <mat-label>Animal</mat-label>
            <input matInput formControlName="animalSearch" [matAutocomplete]="animalAutocomplete" placeholder="Buscar por arete, marca o tatuaje" />
            <mat-autocomplete #animalAutocomplete="matAutocomplete" (optionSelected)="selectAnimal($event)">
              @for (animal of animalOptions(); track animal.uuid) {
                <mat-option [value]="animal.uuid">{{ animalLabel(animal) }}</mat-option>
              }
            </mat-autocomplete>
          </mat-form-field>
        }

        <mat-form-field appearance="outline">
          <mat-label>Fecha/hora</mat-label>
          <input matInput type="datetime-local" formControlName="occurredAt" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Próximo control</mat-label>
          <input matInput type="datetime-local" formControlName="nextDueAt" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Veterinario</mat-label>
          <input matInput formControlName="veterinarianName" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Matrícula veterinaria</mat-label>
          <input matInput formControlName="veterinarianLicense" />
        </mat-form-field>

        <mat-form-field appearance="outline" class="form-field--full">
          <mat-label>Notas de atención</mat-label>
          <textarea matInput formControlName="notes"></textarea>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Motivo</mat-label>
          <input matInput formControlName="reason" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Hallazgos</mat-label>
          <input matInput formControlName="findings" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Plan</mat-label>
          <input matInput formControlName="plan" />
        </mat-form-field>

        @if (showAnimalRequiredError()) {
          <div class="form-alert form-field--full" role="alert">Seleccioná el animal de la visita específica.</div>
        }
        <app-form-errors [control]="form.controls.veterinarianName" [messages]="messages.veterinarianName" />
        <app-form-errors [control]="form.controls.occurredAt" [messages]="messages.occurredAt" />
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Cancelar</button>
      <button mat-flat-button color="primary" type="button" [disabled]="form.invalid" (click)="submit()">Guardar visita</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dialog-content { max-height: min(82vh, 52rem); overflow: auto; }
      .dialog-form { display: grid; gap: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); padding-top: .5rem; width: min(72rem, 100%); }
      .form-field--full { grid-column: 1 / -1; }
      .form-alert { color: #b3261e; font-weight: 600; }
      @media (max-width: 720px) { .dialog-form { grid-template-columns: minmax(0, 1fr); } }
    `,
  ],
})
export class VetVisitFormDialogComponent {
  readonly data = inject<VetVisitDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  readonly dialogRef = inject(MatDialogRef<VetVisitFormDialogComponent, VetVisitDialogResult | undefined>);
  private readonly formBuilder = inject(FormBuilder);
  private readonly animalsService = inject(AnimalsService);
  private readonly animalCandidates = signal<AnimalItem[]>([]);

  readonly form = this.formBuilder.group(
    {
      mode: [this.data.mode ?? 'SPECIFIC' as VetVisitDialogMode, [Validators.required]],
      animalUuid: this.formBuilder.control<string | null>(null),
      animalSearch: [''],
      visitId: [createUuid(), [Validators.required]],
      status: ['PENDING' as VetVisitDialogStatus, [Validators.required]],
      occurredAt: [currentLocalDateTimeInput(), [Validators.required]],
      nextDueAt: [''],
      notes: [''],
      reason: ['', [Validators.required]],
      findings: ['', [Validators.required]],
      plan: ['', [Validators.required]],
      veterinarianName: ['', [Validators.required]],
      veterinarianLicense: [''],
      targetAnimalCount: [this.data.targetAnimalCount ?? null],
      parentVisitId: [this.data.parentVisitId ?? null],
    },
    { validators: [specificAnimalValidator] },
  );

  readonly messages = {
    veterinarianName: { required: 'Ingresá el nombre del veterinario.' },
    occurredAt: { required: 'Informá cuándo se programa o registra la visita.' },
  };

  constructor() {
    this.animalsService.listAnimals({ active: true }).subscribe({
      next: (animals) => this.animalCandidates.set([...animals].filter((animal) => animal.active).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))),
      error: () => this.animalCandidates.set([]),
    });

    this.form.controls.mode.valueChanges.subscribe((mode) => {
      if (mode === 'GLOBAL') {
        this.form.controls.animalUuid.setValue(null);
        this.form.controls.animalSearch.setValue('');
      }
      this.form.updateValueAndValidity();
    });

    this.form.controls.animalSearch.valueChanges.subscribe((search) => {
      const selectedAnimal = this.animalCandidates().find((animal) => animal.uuid === this.form.controls.animalUuid.value) ?? null;
      if (selectedAnimal && search !== animalLabel(selectedAnimal)) {
        this.form.controls.animalUuid.setValue(null);
      }
    });
  }

  animalLabel(animal: AnimalItem) {
    return animalLabel(animal);
  }

  animalOptions() {
    return filterAnimalCandidates(this.animalCandidates(), this.form.controls.animalSearch.value);
  }

  selectAnimal(event: MatAutocompleteSelectedEvent) {
    const selectedUuid = event.option.value as string;
    const selectedAnimal = this.animalCandidates().find((animal) => animal.uuid === selectedUuid) ?? null;
    this.form.controls.animalUuid.setValue(selectedAnimal?.uuid ?? null);
    this.form.controls.animalSearch.setValue(selectedAnimal ? animalLabel(selectedAnimal) : '');
    this.form.updateValueAndValidity();
  }

  showAnimalRequiredError() {
    return this.form.touched && this.form.hasError('animalRequired');
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.form.updateValueAndValidity();
      return;
    }

    const value = this.form.getRawValue();
    this.dialogRef.close({
      mode: value.mode ?? 'SPECIFIC',
      animalUuid: value.mode === 'GLOBAL' ? null : value.animalUuid,
      visitId: value.visitId ?? '',
      status: value.status ?? 'PENDING',
      occurredAt: value.occurredAt ?? '',
      nextDueAt: normalizeOptionalText(value.nextDueAt),
      notes: normalizeOptionalText(value.notes),
      reason: normalizeRequiredText(value.reason),
      findings: normalizeRequiredText(value.findings),
      plan: normalizeRequiredText(value.plan),
      veterinarianName: normalizeRequiredText(value.veterinarianName),
      veterinarianLicense: normalizeOptionalText(value.veterinarianLicense),
      targetAnimalCount: value.targetAnimalCount,
      parentVisitId: normalizeOptionalText(value.parentVisitId),
    });
  }
}

const specificAnimalValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as { mode?: VetVisitDialogMode | null; animalUuid?: string | null };
  return value.mode === 'SPECIFIC' && !value.animalUuid ? { animalRequired: true } : null;
};

function filterAnimalCandidates(candidates: AnimalItem[], search: string | null | undefined) {
  const normalizedSearch = normalizeSearchText(search);
  return candidates
    .filter((animal) => !normalizedSearch || animalSearchText(animal).includes(normalizedSearch))
    .slice(0, 10);
}

function animalSearchText(animal: AnimalItem) {
  return [animal.arete, animal.marca, animal.tatuaje, animalLabel(animal)]
    .filter((value): value is string => Boolean(value))
    .join(' ')
    .toLocaleLowerCase('es');
}

function animalLabel(animal: AnimalItem) {
  return [animal.arete, animal.marca, animal.tatuaje].filter((value): value is string => Boolean(value)).join(' · ') || 'animal sin identificador';
}

function normalizeSearchText(value: string | null | undefined) {
  return value?.trim().toLocaleLowerCase('es') ?? '';
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeRequiredText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function currentLocalDateTimeInput() {
  return new Date().toISOString().slice(0, 16);
}

function createUuid() {
  return globalThis.crypto?.randomUUID?.() ?? 'vet-visit-local-id';
}

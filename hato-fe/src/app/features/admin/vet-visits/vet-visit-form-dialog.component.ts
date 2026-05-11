import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, ReactiveFormsModule, Validators, type AbstractControl, type FormControl, type ValidationErrors, type ValidatorFn } from '@angular/forms';
import { DragDropModule, type CdkDragDrop } from '@angular/cdk/drag-drop';
import { provideNativeDateAdapter } from '@angular/material/core';
import { MatAutocompleteModule, type MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { FormErrorsComponent } from '../../../shared/ui/form-errors/form-errors.component';
import { AnimalsService, type AnimalItem } from '../animals/data-access/animals.service';

export type VetVisitDialogMode = 'GLOBAL' | 'SPECIFIC';
export type VetVisitDialogStatus = 'PENDING' | 'ATTENDED' | 'RESCHEDULED' | 'FINALIZED' | 'CANCELED';
export type VetVisitDialogAction = 'create' | 'attend' | 'reschedule' | 'followUp';
export type VetVisitFollowUpChoice = 'schedule' | 'finalize';

export interface VetVisitDialogData {
  action?: VetVisitDialogAction;
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
  veterinarianName: string;
  veterinarianLicense: string | null;
  targetAnimalCount: number | null;
  parentVisitId: string | null;
  findings?: string | null;
  cost?: { amount: number; currency: 'BOB' } | null;
  treatmentPlan?: string[];
  followUpChoice?: VetVisitFollowUpChoice | null;
}

@Component({
  selector: 'app-vet-visit-form-dialog',
  standalone: true,
  imports: [
    CommonModule,
    DragDropModule,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
    FormErrorsComponent,
  ],
  providers: [provideNativeDateAdapter()],
  template: `
    <h2 mat-dialog-title>{{ dialogTitle }}</h2>

    <mat-dialog-content class="dialog-content">
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline">
          <mat-label>Modo</mat-label>
          <mat-select formControlName="mode">
            <mat-option value="GLOBAL">Global / Campaña</mat-option>
            <mat-option value="SPECIFIC">Específica</mat-option>
          </mat-select>
        </mat-form-field>

        @if (!isAttendMode) {
          <mat-form-field appearance="outline">
            <mat-label>Estado</mat-label>
            <mat-select formControlName="status">
              @for (option of initialStatusOptions; track option.value) {
                <mat-option [value]="option.value">{{ option.label }}</mat-option>
              }
            </mat-select>
            <mat-hint>Inicial: Programada o Atendida</mat-hint>
          </mat-form-field>
        }

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
          <mat-label>Fecha de visita</mat-label>
          <input matInput [matDatepicker]="occurredAtPicker" formControlName="occurredAt" />
          <mat-datepicker-toggle matIconSuffix [for]="occurredAtPicker" />
          <mat-datepicker #occurredAtPicker />
        </mat-form-field>

        @if (!isAttendMode) {
          <mat-form-field appearance="outline">
            <mat-label>Próximo control</mat-label>
            <input matInput [matDatepicker]="nextDueAtPicker" formControlName="nextDueAt" />
            <mat-datepicker-toggle matIconSuffix [for]="nextDueAtPicker" />
            <mat-datepicker #nextDueAtPicker />
          </mat-form-field>
        }

        <mat-form-field appearance="outline">
          <mat-label>Veterinario</mat-label>
          <input matInput formControlName="veterinarianName" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Matrícula veterinaria</mat-label>
          <input matInput formControlName="veterinarianLicense" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Motivo</mat-label>
          <input matInput formControlName="reason" />
        </mat-form-field>

        @if (!isAttendMode && form.controls.status.value === 'ATTENDED') {
          <mat-form-field appearance="outline" class="form-field--full">
            <mat-label>Notas de atención</mat-label>
            <textarea matInput formControlName="notes"></textarea>
          </mat-form-field>
        }

        @if (isAttendMode) {
          <mat-form-field appearance="outline" class="form-field--full">
            <mat-label>Hallazgos / descripción</mat-label>
            <textarea matInput formControlName="findings" rows="3"></textarea>
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field--full">
            <mat-label>Notas de atención</mat-label>
            <textarea matInput formControlName="attentionNotes" rows="3"></textarea>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Costo</mat-label>
            <input matInput type="number" min="0" formControlName="cost" />
            <span matTextSuffix>BOB</span>
          </mat-form-field>

          <section class="form-section form-field--full">
            <div class="form-section__header">
              <h3>Plan de tratamiento</h3>
              <button mat-stroked-button type="button" (click)="addTreatmentPlanStep()" [disabled]="treatmentPlanControls().length >= maxTreatmentPlanSteps">
                Agregar paso
              </button>
            </div>
            <div cdkDropList class="treatment-plan" (cdkDropListDropped)="dropTreatmentPlanStep($event)">
              @for (step of treatmentPlanControls(); track $index; let index = $index) {
                <div class="treatment-plan__row" cdkDrag>
                  <button mat-icon-button type="button" cdkDragHandle aria-label="Reordenar paso">
                    <mat-icon>drag_indicator</mat-icon>
                  </button>
                  <mat-form-field appearance="outline" class="treatment-plan__input">
                    <mat-label>Paso {{ index + 1 }}</mat-label>
                    <input matInput [formControl]="step" placeholder="Descripción del paso" />
                  </mat-form-field>
                  <button mat-icon-button type="button" aria-label="Eliminar paso" (click)="removeTreatmentPlanStep(index)" [disabled]="treatmentPlanControls().length === 1">
                    <mat-icon>delete</mat-icon>
                  </button>
                </div>
              }
            </div>
          </section>

          <section class="form-section form-field--full">
            <mat-radio-group formControlName="followUpChoice" class="follow-up-choice">
              <mat-radio-button value="schedule">Programar próximo control</mat-radio-button>
              <mat-radio-button value="finalize">Finalizar tratamiento</mat-radio-button>
            </mat-radio-group>
          </section>

          @if (form.controls.followUpChoice.value === 'schedule') {
            <mat-form-field appearance="outline">
              <mat-label>Fecha del próximo control</mat-label>
              <input matInput [matDatepicker]="attendNextDueAtPicker" formControlName="nextDueAt" />
              <mat-datepicker-toggle matIconSuffix [for]="attendNextDueAtPicker" />
              <mat-datepicker #attendNextDueAtPicker />
            </mat-form-field>
          }
        }

        @if (showAnimalRequiredError()) {
          <div class="form-alert form-field--full" role="alert">Seleccioná el animal de la visita específica.</div>
        }
        <app-form-errors [control]="form.controls.veterinarianName" [messages]="messages.veterinarianName" />
        <app-form-errors [control]="form.controls.occurredAt" [messages]="messages.occurredAt" />
        <app-form-errors [control]="form.controls.reason" [messages]="messages.reason" />
        <app-form-errors [control]="form.controls.notes" [messages]="messages.notes" />
        <app-form-errors [control]="form.controls.findings" [messages]="messages.findings" />
        <app-form-errors [control]="form.controls.attentionNotes" [messages]="messages.attentionNotes" />
        <app-form-errors [control]="form.controls.cost" [messages]="messages.cost" />
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Cancelar</button>
      <button mat-flat-button color="primary" type="button" [disabled]="form.invalid" (click)="submit()">{{ submitLabel }}</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dialog-content { max-height: min(82vh, 52rem); overflow: auto; }
      .dialog-form { display: grid; gap: 1rem; grid-template-columns: repeat(2, minmax(0, 1fr)); padding-top: .5rem; width: min(72rem, 100%); }
      .form-field--full { grid-column: 1 / -1; }
      .form-alert { color: #b3261e; font-weight: 600; }
      .form-section { border: 1px solid rgba(0, 0, 0, .12); border-radius: .75rem; padding: 1rem; }
      .form-section__header { align-items: center; display: flex; gap: 1rem; justify-content: space-between; margin-bottom: .75rem; }
      .form-section__header h3 { font-size: 1rem; margin: 0; }
      .treatment-plan { display: grid; gap: .75rem; }
      .treatment-plan__row { align-items: start; display: grid; gap: .5rem; grid-template-columns: auto minmax(0, 1fr) auto; }
      .treatment-plan__input { width: 100%; }
      .follow-up-choice { display: grid; gap: .75rem; }
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
  readonly maxTreatmentPlanSteps = 20;
  readonly isAttendMode = this.data.action === 'attend';
  readonly dialogTitle = this.isAttendMode ? 'Atender visita' : 'Nueva visita veterinaria';
  readonly submitLabel = this.isAttendMode ? 'Guardar atención' : 'Guardar visita';

  readonly initialStatusOptions: readonly { value: VetVisitDialogStatus; label: string }[] = [
    { value: 'PENDING', label: 'Programada' },
    { value: 'ATTENDED', label: 'Atendida' },
  ];

  readonly form = this.formBuilder.group(
    {
      mode: [this.data.mode ?? 'SPECIFIC' as VetVisitDialogMode, [Validators.required]],
      animalUuid: this.formBuilder.control<string | null>(null),
      animalSearch: [''],
      visitId: [createUuid(), [Validators.required]],
      status: [this.isAttendMode ? 'ATTENDED' as VetVisitDialogStatus : 'PENDING' as VetVisitDialogStatus, [Validators.required]],
      occurredAt: [currentLocalDateInput(), [Validators.required]],
      nextDueAt: this.formBuilder.control<Date | null>(null),
      notes: [''],
      findings: ['', this.isAttendMode ? [Validators.required, Validators.minLength(5)] : []],
      attentionNotes: ['', this.isAttendMode ? [Validators.required] : []],
      cost: this.formBuilder.control<number | null>(null, [nonNegativeCostValidator]),
      treatmentPlan: this.formBuilder.array<FormControl<string>>([this.createTreatmentPlanControl()]),
      followUpChoice: [this.isAttendMode ? 'schedule' as VetVisitFollowUpChoice : null],
      reason: ['', [Validators.required]],
      veterinarianName: ['', [Validators.required]],
      veterinarianLicense: [''],
      targetAnimalCount: [this.data.targetAnimalCount ?? null],
      parentVisitId: [this.data.parentVisitId ?? null],
    },
    { validators: [specificAnimalValidator, attendedNotesValidator, followUpDateValidator, treatmentPlanLimitValidator] },
  );

  readonly messages = {
    veterinarianName: { required: 'Ingresá el nombre del veterinario.' },
    occurredAt: { required: 'Informá cuándo se programa o registra la visita.' },
    reason: { required: 'Ingresá el motivo de la visita.' },
    notes: { attentionRequired: 'Ingresá las notas de atención para una visita atendida.' },
    findings: { required: 'Ingresá los hallazgos de la atención.', minlength: 'Ingresá al menos 5 caracteres.' },
    attentionNotes: { required: 'Ingresá las notas de atención.' },
    cost: { min: 'El costo no puede ser negativo.' },
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

    this.form.controls.status.valueChanges.subscribe(() => {
      this.form.controls.notes.updateValueAndValidity({ onlySelf: true });
      this.form.updateValueAndValidity();
    });

    this.form.controls.followUpChoice.valueChanges.subscribe((choice) => {
      if (choice === 'finalize') {
        this.form.controls.nextDueAt.setValue(null);
      }
      this.form.updateValueAndValidity();
    });
  }

  treatmentPlanControls() {
    return this.form.controls.treatmentPlan.controls;
  }

  addTreatmentPlanStep(description = '') {
    if (this.treatmentPlanControls().length >= this.maxTreatmentPlanSteps) {
      return;
    }
    this.form.controls.treatmentPlan.push(this.createTreatmentPlanControl(description));
  }

  removeTreatmentPlanStep(index: number) {
    if (this.treatmentPlanControls().length === 1) {
      return;
    }
    this.form.controls.treatmentPlan.removeAt(index);
  }

  dropTreatmentPlanStep(event: CdkDragDrop<FormControl<string>[]>) {
    const controls = this.treatmentPlanControls();
    const moved = controls[event.previousIndex];
    this.form.controls.treatmentPlan.removeAt(event.previousIndex);
    this.form.controls.treatmentPlan.insert(event.currentIndex, moved);
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
    const attentionNotes = this.isAttendMode ? normalizeOptionalText(value.attentionNotes) : normalizeOptionalText(value.notes);
    const costAmount = normalizeCostAmount(value.cost);
    const treatmentPlan = value.treatmentPlan.map((step) => step.trim()).filter(Boolean);
    this.dialogRef.close({
      mode: value.mode ?? 'SPECIFIC',
      animalUuid: value.mode === 'GLOBAL' ? null : value.animalUuid,
      visitId: value.visitId ?? '',
      status: this.isAttendMode ? 'ATTENDED' : value.status ?? 'PENDING',
      occurredAt: normalizeDateValue(value.occurredAt ?? currentLocalDateInput()),
      nextDueAt: normalizeOptionalDate(value.nextDueAt),
      notes: attentionNotes,
      reason: normalizeRequiredText(value.reason),
      veterinarianName: normalizeRequiredText(value.veterinarianName),
      veterinarianLicense: normalizeOptionalText(value.veterinarianLicense),
      targetAnimalCount: value.targetAnimalCount,
      parentVisitId: normalizeOptionalText(value.parentVisitId),
      findings: this.isAttendMode ? normalizeOptionalText(value.findings) : null,
      cost: this.isAttendMode && costAmount !== null ? { amount: costAmount, currency: 'BOB' } : null,
      treatmentPlan: this.isAttendMode ? treatmentPlan : [],
      followUpChoice: this.isAttendMode ? value.followUpChoice : null,
    });
  }

  private createTreatmentPlanControl(value = '') {
    const validators = this.isAttendMode ? [Validators.required, Validators.maxLength(300)] : [];
    return this.formBuilder.control(value, { nonNullable: true, validators });
  }
}

const specificAnimalValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as { mode?: VetVisitDialogMode | null; animalUuid?: string | null };
  return value.mode === 'SPECIFIC' && !value.animalUuid ? { animalRequired: true } : null;
};

const attendedNotesValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as { status?: VetVisitDialogStatus | null; notes?: string | null; attentionNotes?: string | null };
  const notesControl = control.get('notes');
  const currentErrors = notesControl?.errors ?? null;
  if (value.status === 'ATTENDED' && !normalizeOptionalText(value.notes) && !normalizeOptionalText(value.attentionNotes)) {
    notesControl?.setErrors({ ...(currentErrors ?? {}), attentionRequired: true });
    return { attentionNotesRequired: true };
  }
  if (currentErrors?.['attentionRequired']) {
    const { attentionRequired: _attentionRequired, ...remainingErrors } = currentErrors;
    notesControl?.setErrors(Object.keys(remainingErrors).length ? remainingErrors : null);
  }
  return null;
};

const nonNegativeCostValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as number | string | null | undefined;
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? null : { min: true };
};

const followUpDateValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as { followUpChoice?: VetVisitFollowUpChoice | null; nextDueAt?: Date | string | null };
  return value.followUpChoice === 'schedule' && !value.nextDueAt ? { nextDueAtRequired: true } : null;
};

const treatmentPlanLimitValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const treatmentPlan = control.get('treatmentPlan') as FormArray<FormControl<string>> | null;
  return treatmentPlan && treatmentPlan.length <= 20 ? null : { treatmentPlanLimit: true };
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

function normalizeOptionalDate(value: Date | string | null | undefined) {
  return value ? normalizeDateValue(value) : null;
}

function normalizeRequiredText(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function normalizeCostAmount(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function normalizeDateValue(value: Date | string) {
  if (value instanceof Date) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())).toISOString();
  }
  return value;
}

function currentLocalDateInput() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function createUuid() {
  return globalThis.crypto?.randomUUID?.() ?? 'vet-visit-local-id';
}

import { CommonModule } from '@angular/common';
import { Component, Injectable, inject, signal } from '@angular/core';
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
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { FormErrorsComponent } from '../../../shared/ui/form-errors/form-errors.component';
import { AnimalsService, type AnimalItem } from '../animals/data-access/animals.service';

export type VetVisitDialogMode = 'GLOBAL' | 'SPECIFIC';
export type VetVisitDialogStatus = 'PENDING' | 'ATTENDED' | 'RESCHEDULED' | 'FINALIZED' | 'CANCELED';
export type VetVisitDialogAction = 'create' | 'attend' | 'reschedule' | 'followUp';
export type VetVisitFollowUpChoice = 'schedule' | 'finalize';
export type VetVisitCreationMode = 'scheduled' | 'attendedNow';

@Injectable({ providedIn: 'root' })
export class DateTimeClock {
  nowIso() {
    return new Date().toISOString();
  }
}

export interface VetVisitDialogData {
  action?: VetVisitDialogAction;
  mode?: VetVisitDialogMode;
  animalUuid?: string | null;
  visitId?: string | null;
  status?: VetVisitDialogStatus;
  creationMode?: VetVisitCreationMode;
  occurredAt?: string | Date | null;
  nextDueAt?: string | Date | null;
  reason?: string | null;
  veterinarianName?: string | null;
  veterinarianLicense?: string | null;
  parentVisitId?: string | null;
  targetAnimalCount?: number | null;
}

export interface VetVisitDialogResult {
  mode: VetVisitDialogMode;
  creationMode: VetVisitCreationMode;
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
    MatSelectModule,
    MatSlideToggleModule,
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
            <mat-label>Tipo de creación</mat-label>
            <mat-select formControlName="creationMode">
              @for (option of creationModeOptions; track option.value) {
                <mat-option [value]="option.value">{{ option.label }}</mat-option>
              }
            </mat-select>
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

        @if (showVisitDateField()) {
          <mat-form-field appearance="outline">
            <mat-label>Fecha de visita</mat-label>
            <input matInput [matDatepicker]="occurredAtPicker" formControlName="occurredAt" />
            <mat-datepicker-toggle matIconSuffix [for]="occurredAtPicker" />
            <mat-datepicker #occurredAtPicker />
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

        @if (isClinicalMode()) {
          <mat-form-field appearance="outline" class="form-field--full">
            <mat-label>Hallazgos / descripción</mat-label>
            <textarea matInput formControlName="findings" rows="3"></textarea>
          </mat-form-field>

          <mat-form-field appearance="outline" class="form-field--full">
            <mat-label>Notas de atención</mat-label>
            <textarea matInput formControlName="attentionNotes" rows="3"></textarea>
          </mat-form-field>

          <mat-slide-toggle class="form-field--full" formControlName="hasTreatment">Tiene tratamiento</mat-slide-toggle>

          @if (form.controls.hasTreatment.value) {
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
          }

          <section class="follow-up-grid form-field--full">
            <mat-form-field appearance="outline">
              <mat-label>Acción posterior</mat-label>
              <mat-select formControlName="followUpChoice">
                <mat-option value="schedule">Programar próximo control</mat-option>
                <mat-option value="finalize">Finalizar tratamiento</mat-option>
              </mat-select>
            </mat-form-field>

            <div class="follow-up-grid__date">
              @if (form.controls.followUpChoice.value === 'schedule') {
                <mat-form-field appearance="outline">
                  <mat-label>Fecha del próximo control</mat-label>
                  <input matInput [matDatepicker]="attendNextDueAtPicker" formControlName="nextDueAt" />
                  <mat-datepicker-toggle matIconSuffix [for]="attendNextDueAtPicker" />
                  <mat-datepicker #attendNextDueAtPicker />
                </mat-form-field>
              }
            </div>
          </section>
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
      .follow-up-grid { align-items: start; display: grid; gap: 1rem; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
      .follow-up-grid__date mat-form-field { width: 100%; }
      @media (max-width: 720px) { .dialog-form { grid-template-columns: minmax(0, 1fr); } }
      @media (max-width: 720px) { .follow-up-grid { grid-template-columns: minmax(0, 1fr); } }
    `,
  ],
})
export class VetVisitFormDialogComponent {
  readonly data = inject<VetVisitDialogData>(MAT_DIALOG_DATA, { optional: true }) ?? {};
  readonly dialogRef = inject(MatDialogRef<VetVisitFormDialogComponent, VetVisitDialogResult | undefined>);
  private readonly formBuilder = inject(FormBuilder);
  private readonly animalsService = inject(AnimalsService);
  private readonly clock = inject(DateTimeClock);
  private readonly animalCandidates = signal<AnimalItem[]>([]);
  readonly maxTreatmentPlanSteps = 20;
  readonly isAttendMode = this.data.action === 'attend';
  readonly dialogTitle = this.isAttendMode ? 'Atender visita' : 'Nueva visita veterinaria';
  readonly submitLabel = this.isAttendMode ? 'Guardar atención' : 'Guardar visita';
  readonly creationModeOptions: readonly { value: VetVisitCreationMode; label: string }[] = [
    { value: 'scheduled', label: 'Programada' },
    { value: 'attendedNow', label: 'Atendida inmediata' },
  ];

  readonly form = this.formBuilder.group(
    {
      action: [this.data.action ?? 'create' as VetVisitDialogAction],
      mode: [this.data.mode ?? 'SPECIFIC' as VetVisitDialogMode, [Validators.required]],
      creationMode: [this.data.creationMode ?? 'scheduled' as VetVisitCreationMode, [Validators.required]],
      animalUuid: this.formBuilder.control<string | null>(this.data.animalUuid ?? null),
      animalSearch: [''],
      visitId: [this.data.visitId ?? createUuid(), [Validators.required]],
      status: [this.data.status ?? (this.isAttendMode ? 'ATTENDED' as VetVisitDialogStatus : 'PENDING' as VetVisitDialogStatus), [Validators.required]],
      occurredAt: [this.data.occurredAt ?? (this.data.creationMode === 'attendedNow' ? this.clock.nowIso() : currentLocalDateInput()), [Validators.required]],
      nextDueAt: this.formBuilder.control<Date | string | null>(this.data.nextDueAt ?? null),
      notes: [''],
      findings: [''],
      attentionNotes: [''],
      cost: this.formBuilder.control<number | null>(null, [nonNegativeCostValidator]),
      hasTreatment: [false],
      treatmentPlan: this.formBuilder.array<FormControl<string>>([this.createTreatmentPlanControl()]),
      followUpChoice: [null as VetVisitFollowUpChoice | null],
      reason: [this.data.reason ?? '', [Validators.required]],
      veterinarianName: [this.data.veterinarianName ?? '', [Validators.required]],
      veterinarianLicense: [this.data.veterinarianLicense ?? ''],
      targetAnimalCount: [this.data.targetAnimalCount ?? null],
      parentVisitId: [this.data.parentVisitId ?? null],
    },
    { validators: [specificAnimalValidator, attendedNowValidator, followUpDateValidator, treatmentPlanLimitValidator] },
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

    this.form.controls.creationMode.valueChanges.subscribe((creationMode) => {
      if (creationMode === 'attendedNow' && !this.isAttendMode) {
        this.form.controls.occurredAt.setValue(this.clock.nowIso());
        this.form.controls.nextDueAt.setValue(null);
      }
      if (creationMode === 'scheduled' && !this.isAttendMode) {
        this.form.controls.followUpChoice.setValue(null);
      }
      this.form.updateValueAndValidity();
    });

    this.form.controls.followUpChoice.valueChanges.subscribe((choice) => {
      if (choice === 'finalize') {
        this.form.controls.nextDueAt.setValue(null);
      }
      this.form.updateValueAndValidity();
    });

    this.form.controls.hasTreatment.valueChanges.subscribe((hasTreatment) => {
      if (!hasTreatment) {
        this.treatmentPlanControls().forEach((control) => control.setValue(''));
      }
      this.form.updateValueAndValidity();
    });
  }

  treatmentPlanControls() {
    return this.form.controls.treatmentPlan.controls;
  }

  isClinicalMode() {
    return this.isAttendMode || this.form.controls.creationMode.value === 'attendedNow';
  }

  showVisitDateField() {
    return this.isAttendMode || this.form.controls.creationMode.value === 'scheduled';
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
    const isClinicalMode = this.isAttendMode || value.creationMode === 'attendedNow';
    const attentionNotes = isClinicalMode ? normalizeOptionalText(value.attentionNotes) : normalizeOptionalText(value.notes);
    const costAmount = normalizeCostAmount(value.cost);
    const treatmentPlan = value.hasTreatment ? value.treatmentPlan.map((step) => step.trim()).filter(Boolean) : [];
    this.dialogRef.close({
      mode: value.mode ?? 'SPECIFIC',
      creationMode: this.isAttendMode ? 'attendedNow' : value.creationMode ?? 'scheduled',
      animalUuid: value.mode === 'GLOBAL' ? null : value.animalUuid,
      visitId: value.visitId ?? '',
      status: isClinicalMode ? 'ATTENDED' : 'PENDING',
      occurredAt: value.creationMode === 'attendedNow' && !this.isAttendMode ? this.clock.nowIso() : normalizeDateValue(value.occurredAt ?? currentLocalDateInput()),
      nextDueAt: normalizeOptionalDate(value.nextDueAt),
      notes: attentionNotes,
      reason: normalizeRequiredText(value.reason),
      veterinarianName: normalizeRequiredText(value.veterinarianName),
      veterinarianLicense: normalizeOptionalText(value.veterinarianLicense),
      targetAnimalCount: value.targetAnimalCount,
      parentVisitId: normalizeOptionalText(value.parentVisitId),
      findings: isClinicalMode ? normalizeOptionalText(value.findings) : null,
      cost: isClinicalMode && costAmount !== null ? { amount: costAmount, currency: 'BOB' } : null,
      treatmentPlan: isClinicalMode ? treatmentPlan : [],
      followUpChoice: isClinicalMode ? value.followUpChoice : null,
    });
  }

  private createTreatmentPlanControl(value = '') {
    const validators = this.isAttendMode ? [Validators.maxLength(300)] : [];
    return this.formBuilder.control(value, { nonNullable: true, validators });
  }
}

const specificAnimalValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as { mode?: VetVisitDialogMode | null; animalUuid?: string | null };
  return value.mode === 'SPECIFIC' && !value.animalUuid ? { animalRequired: true } : null;
};

export const attendedNowValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as {
    action?: VetVisitDialogAction | null;
    creationMode?: VetVisitCreationMode | null;
    findings?: string | null;
    attentionNotes?: string | null;
  };
  const isClinicalMode = value.action === 'attend' || value.creationMode === 'attendedNow' || control.get('status')?.value === 'ATTENDED' && control.get('creationMode')?.value === 'attendedNow';
  if (!isClinicalMode) {
    return null;
  }

  const errors: ValidationErrors = {};
  if (!normalizeOptionalText(value.findings)) {
    errors['findingsRequired'] = true;
  }
  if (!normalizeOptionalText(value.attentionNotes)) {
    errors['attentionNotesRequired'] = true;
  }
  return Object.keys(errors).length ? errors : null;
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
  const value = control.value as { action?: VetVisitDialogAction | null; creationMode?: VetVisitCreationMode | null; followUpChoice?: VetVisitFollowUpChoice | null; nextDueAt?: Date | string | null };
  const isClinicalMode = value.action === 'attend' || value.creationMode === 'attendedNow' || control.get('status')?.value === 'ATTENDED' && control.get('creationMode')?.value === 'attendedNow';
  if (!isClinicalMode) {
    return null;
  }
  if (!value.followUpChoice) {
    return { followUpChoiceRequired: true };
  }
  return value.followUpChoice === 'schedule' && !value.nextDueAt ? { nextDueAtRequired: true } : null;
};

const treatmentPlanLimitValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const treatmentPlan = control.get('treatmentPlan') as FormArray<FormControl<string>> | null;
  if (!treatmentPlan || treatmentPlan.length > 20) {
    return { treatmentPlanLimit: true };
  }

  const value = control.value as { hasTreatment?: boolean | null };
  const hasTreatmentPlan = treatmentPlan.controls.some((step) => Boolean(step.value.trim()));
  return value.hasTreatment && !hasTreatmentPlan ? { treatmentPlanRequired: true } : null;
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

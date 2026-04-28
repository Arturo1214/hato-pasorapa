import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormArray,
  FormBuilder,
  ReactiveFormsModule,
  Validators,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, firstValueFrom } from 'rxjs';
import {
  FIELD_VET_CHECKLIST_CODES,
  FIELD_VET_PROTOCOL_STATUSES,
  type FieldVetChecklistCode,
  type FieldVetChecklistItem,
} from '../../../core/offline/offline-types';
import { FormErrorsComponent } from '../../../shared/ui/form-errors/form-errors.component';
import { AnimalsHealthEventsService, type AnimalHealthEventItem } from '../animals/data-access/animals-health-events.service';
import { mapVetVisitFormToCreateInput } from './data-access/vet-visit-form.mapper';

@Component({
  selector: 'app-vet-visits-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    FormErrorsComponent,
  ],
  template: `
    <section class="admin-page">
      <header class="page-header">
        <h1>Visitas veterinarias</h1>
        <p>Flujo offline-first para checklist fijo, nota clínica y protocolo básico por visitId.</p>
      </header>

      <mat-card appearance="outlined">
        <div class="card-title-row">
          <div>
            <h2>Filtros</h2>
            <p>Listá por animal y, si querés, cerrá la vista a un visitId puntual.</p>
          </div>
          <a mat-stroked-button routerLink="/admin/animales">Volver a animales</a>
        </div>

        <form [formGroup]="filtersForm" class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label>UUID animal *</mat-label>
            <input matInput formControlName="animalUuid" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>visitId</mat-label>
            <input matInput formControlName="visitId" />
          </mat-form-field>

          <div class="form-actions inline-actions">
            <button mat-flat-button color="primary" type="button" (click)="loadVisits()">Cargar visitas</button>
          </div>
        </form>
      </mat-card>

      <mat-card appearance="outlined">
        <div class="card-title-row">
          <div>
            <h2>Registrar visita</h2>
            <p>El operationId lo genera el servicio; acá definís un visitId independiente y reutilizable.</p>
          </div>
          <button mat-stroked-button type="button" (click)="regenerateVisitId()">Regenerar visitId</button>
        </div>

        <form [formGroup]="form" class="form-grid" (ngSubmit)="submitForm()">
          <mat-form-field appearance="outline">
            <mat-label>UUID animal *</mat-label>
            <input matInput formControlName="animalUuid" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>visitId *</mat-label>
            <input matInput formControlName="visitId" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Fecha/hora *</mat-label>
            <input matInput type="datetime-local" formControlName="occurredAt" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Estado protocolo *</mat-label>
            <mat-select formControlName="protocolStatus">
              @for (status of protocolStatuses; track status) {
                <mat-option [value]="status">{{ status }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Próximo control</mat-label>
            <input matInput type="datetime-local" formControlName="nextDueAt" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Notas</mat-label>
            <input matInput formControlName="notes" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Motivo *</mat-label>
            <input matInput formControlName="reason" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Hallazgos *</mat-label>
            <input matInput formControlName="findings" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Plan *</mat-label>
            <input matInput formControlName="plan" />
          </mat-form-field>

          <div class="checklist-grid" formArrayName="checklist">
            @for (control of checklistControls.controls; track $index) {
              <div class="checklist-card" [formGroupName]="$index">
                <mat-checkbox formControlName="ok">{{ checklistCodes[$index] }}</mat-checkbox>
                <input matInput placeholder="Observación opcional" formControlName="note" />
              </div>
            }
          </div>

          <app-form-errors [control]="form.controls.animalUuid" [messages]="messages.animalUuid" />
          <app-form-errors [control]="form.controls.visitId" [messages]="messages.visitId" />
          <app-form-errors [control]="form.controls.occurredAt" [messages]="messages.occurredAt" />
          <app-form-errors [control]="form.controls.reason" [messages]="messages.reason" />
          <app-form-errors [control]="form.controls.findings" [messages]="messages.findings" />
          <app-form-errors [control]="form.controls.plan" [messages]="messages.plan" />

          @if (showProtocolError()) {
            <div class="form-alert" role="alert">Cuando el protocolo queda FOLLOW_UP_REQUIRED necesitás nextDueAt.</div>
          }

          <div class="form-actions">
            <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || submitting()">
              {{ submitting() ? 'Guardando…' : 'Registrar visita veterinaria' }}
            </button>
          </div>
        </form>
      </mat-card>

      @if (feedbackMessage()) {
        <mat-card appearance="outlined"><p>{{ feedbackMessage() }}</p></mat-card>
      }

      @if (visits().length) {
        <mat-card appearance="outlined">
          <h2>Listado</h2>
          <ul>
            @for (visit of visits(); track visit.id) {
              <li>
                <strong>{{ visit.visitId ?? visit.operationId }}</strong>
                · {{ visit.occurredAt }}
                @if (visit.treatmentStatus) {
                  <span> · {{ visit.treatmentStatus === 'closed' ? 'CLOSED' : 'ACTIVE' }}</span>
                }
                @if (visit.nextDueAt) {
                  <span> · próximo {{ visit.nextDueAt }}</span>
                }
                @if (visit.notes) {
                  <span> · {{ visit.notes }}</span>
                }
              </li>
            }
          </ul>
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

      .card-title-row {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: start;
        margin-bottom: 1rem;
      }

      .form-grid {
        display: grid;
        gap: 1rem;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }

      .checklist-grid,
      .form-actions,
      .form-alert {
        grid-column: 1 / -1;
      }

      .checklist-grid {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }

      .checklist-card {
        display: grid;
        gap: 0.5rem;
        padding: 0.75rem;
        border: 1px solid #ddd;
        border-radius: 0.75rem;
      }

      .form-alert {
        color: #b3261e;
        font-weight: 600;
      }

      .inline-actions {
        align-self: end;
      }
    `,
  ],
})
export class VetVisitsPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly animalsHealthEventsService = inject(AnimalsHealthEventsService);

  readonly checklistCodes = FIELD_VET_CHECKLIST_CODES;
  readonly protocolStatuses = FIELD_VET_PROTOCOL_STATUSES;
  readonly visits = signal<AnimalHealthEventItem[]>([]);
  readonly submitting = signal(false);
  readonly feedbackMessage = signal<string | null>(null);

  readonly filtersForm = this.formBuilder.group({
    animalUuid: ['', [Validators.required]],
    visitId: [''],
  });

  readonly form = this.formBuilder.group(
    {
      animalUuid: ['', [Validators.required]],
      visitId: [createUuid() as string, [Validators.required]],
      occurredAt: [currentLocalDateTimeInput(), [Validators.required]],
      protocolStatus: ['STARTED', [Validators.required]],
      nextDueAt: [''],
      notes: [''],
      reason: ['', [Validators.required]],
      findings: ['', [Validators.required]],
      plan: ['', [Validators.required]],
      checklist: this.formBuilder.array(this.checklistCodes.map((code) => this.createChecklistControl(code))),
    },
    { validators: [vetVisitProtocolValidator] }
  );

  readonly messages = {
    animalUuid: { required: 'Seleccioná el animal de la visita.' },
    visitId: { required: 'Necesitás un visitId explícito.' },
    occurredAt: { required: 'Informá cuándo ocurrió la visita.' },
    reason: { required: 'Completá el motivo clínico.' },
    findings: { required: 'Completá los hallazgos clínicos.' },
    plan: { required: 'Completá el plan clínico.' },
  };

  get checklistControls() {
    return this.form.controls.checklist as FormArray;
  }

  constructor() {
    const animalUuid = this.route.snapshot.queryParamMap.get('animalUuid') ?? '';
    if (animalUuid) {
      this.filtersForm.patchValue({ animalUuid });
      this.form.patchValue({ animalUuid });
      void this.loadVisits();
    }
  }

  regenerateVisitId() {
    this.form.patchValue({ visitId: createUuid() });
  }

  async loadVisits() {
    const filters = this.filtersForm.getRawValue();
    if (!filters.animalUuid) {
      return;
    }

    this.visits.set(
      await firstValueFrom(
        this.animalsHealthEventsService.listEvents(filters.animalUuid, {
          healthEventType: 'FIELD_VET_VISIT',
          visitId: filters.visitId?.trim() || undefined,
        })
      )
    );
  }

  submitForm() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.form.updateValueAndValidity();
      return;
    }

    this.submitting.set(true);
    this.feedbackMessage.set(null);
    this.animalsHealthEventsService
      .createEvent(mapVetVisitFormToCreateInput(this.readFormValue()))
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: async (result) => {
          this.feedbackMessage.set(result.message);
          this.filtersForm.patchValue({ animalUuid: this.form.controls.animalUuid.value, visitId: this.form.controls.visitId.value });
          await this.loadVisits();
        },
      });
  }

  showProtocolError() {
    return this.form.touched && this.form.hasError('nextDueAtRequired');
  }

  private createChecklistControl(code: FieldVetChecklistCode) {
    return this.formBuilder.group({
      code: [code, [Validators.required]],
      ok: [false],
      note: [''],
    });
  }

  private readFormValue() {
    const value = this.form.getRawValue();
    return {
      animalUuid: value.animalUuid ?? '',
      visitId: value.visitId ?? '',
      occurredAt: value.occurredAt ?? '',
      notes: value.notes,
      checklist: (value.checklist ?? []) as FieldVetChecklistItem[],
      clinicalNote: {
        reason: value.reason ?? '',
        findings: value.findings ?? '',
        plan: value.plan ?? '',
      },
      protocolStatus: value.protocolStatus as 'STARTED' | 'FOLLOW_UP_REQUIRED' | 'CLOSED',
      nextDueAt: value.nextDueAt,
    };
  }
}

const vetVisitProtocolValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as { protocolStatus?: string | null; nextDueAt?: string | null };
  if (value.protocolStatus !== 'FOLLOW_UP_REQUIRED') {
    return null;
  }
  return value.nextDueAt?.trim() ? null : { nextDueAtRequired: true };
};

function currentLocalDateTimeInput() {
  return new Date().toISOString().slice(0, 16);
}

function createUuid() {
  return globalThis.crypto?.randomUUID?.() ?? 'vet-visit-local-id';
}

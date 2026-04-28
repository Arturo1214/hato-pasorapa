import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, type AbstractControl, type ValidationErrors, type ValidatorFn } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { finalize, firstValueFrom } from 'rxjs';
import { OfflineStatusService } from '../../../core/offline/offline-status.service';
import { FormErrorsComponent } from '../../../shared/ui/form-errors/form-errors.component';
import { AnimalsImagesService, type AnimalImageItem } from './data-access/animals-images.service';
import { AnimalsService, type AnimalCategory, type AnimalItem, type AnimalListFilters, type AnimalMutationPayload } from './data-access/animals.service';
import { AnimalsHealthEventsService, type AnimalHealthEventItem } from './data-access/animals-health-events.service';
import {
  AnimalsReproductionEventsService,
  buildBirthMetadata,
  type AnimalReproductionEventItem,
} from './data-access/animals-reproduction-events.service';
import { AnimalsEventsService, type AnimalEventItem } from './data-access/animals-events.service';

@Component({
  selector: 'app-animals-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    RouterLink,
    FormErrorsComponent,
  ],
  template: `
    <section class="admin-page">
      <header class="page-header">
        <h1>Animales</h1>
        <p>Alta y edición de ficha vigente usando UUID canónico, owner actual y visibles operativos.</p>
      </header>

      <mat-card appearance="outlined">
        <p>Estado de sync: {{ syncSummary() }}</p>
        @if (syncState().syncing) {
          <p>Sincronizando cambios offline…</p>
        }
        @if (offlineMessage()) {
          <p>{{ offlineMessage() }}</p>
        }
        @if (syncState().lastMessage) {
          <p>{{ syncState().lastMessage }}</p>
        }
        @if (offlineMutationsBlocked()) {
          <p>La ficha animal todavía confirma alta/edición solo online. El listado puede apoyarse en snapshots locales.</p>
        }
        @if (syncState().manualRefreshRequired) {
          <p>Necesitás refrescar manualmente la lista para resolver un conflicto remoto.</p>
        }
      </mat-card>

      <mat-card appearance="outlined">
        <div class="card-title-row">
          <div>
            <h2>Filtros operativos</h2>
            <p>Buscá por visible, owner actual, categoría y estado operativo.</p>
          </div>
          <div class="filter-actions">
            <button mat-stroked-button type="button" (click)="clearFilters()">Limpiar filtros</button>
            <button mat-flat-button color="primary" type="button" (click)="applyFilters()">Aplicar filtros</button>
          </div>
        </div>

        <form [formGroup]="filtersForm" class="form-grid">
          <mat-form-field appearance="outline">
            <mat-label>Visible</mat-label>
            <input matInput formControlName="visible" />
            <mat-hint>Busca por arete, marca o tatuaje.</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>UUID owner actual</mat-label>
            <input matInput formControlName="ownerGanaderoId" />
            <mat-hint>Filtra por el ganadero vigente.</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Categoría</mat-label>
            <mat-select formControlName="category">
              <mat-option [value]="null">Todas</mat-option>
              @for (option of categoryOptions; track option.value) {
                <mat-option [value]="option.value">{{ option.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Estado operativo</mat-label>
            <mat-select formControlName="active">
              <mat-option [value]="null">Todos</mat-option>
              <mat-option value="true">Activo</mat-option>
              <mat-option value="false">Inactivo</mat-option>
            </mat-select>
          </mat-form-field>
        </form>
      </mat-card>

      <mat-card appearance="outlined">
        <div class="card-title-row">
          <div>
            <h2>Registrar evento operativo</h2>
            <p>Ledger append-only V1 operativo con auditoría mínima y proyección por sync.</p>
          </div>
        </div>

        <form [formGroup]="eventForm" class="form-grid" (ngSubmit)="submitEventForm()">
          <mat-form-field appearance="outline">
            <mat-label>UUID animal *</mat-label>
            <input matInput formControlName="animalUuid" required />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Tipo *</mat-label>
            <mat-select formControlName="type" required>
              @for (option of eventTypeOptions; track option.value) {
                <mat-option [value]="option.value">{{ option.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Fecha/hora ocurrencia *</mat-label>
            <input matInput type="datetime-local" formControlName="occurredAt" required />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Notas</mat-label>
            <input matInput formControlName="notes" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Reason code</mat-label>
            <input matInput formControlName="reasonCode" />
          </mat-form-field>

          @if (eventForm.controls.type.value === 'TRANSFERRED') {
            <mat-form-field appearance="outline">
              <mat-label>Owner origen *</mat-label>
              <input matInput formControlName="fromOwnerGanaderoId" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Owner destino *</mat-label>
              <input matInput formControlName="toOwnerGanaderoId" />
            </mat-form-field>
          }

          <app-form-errors [control]="eventForm.controls.animalUuid" [messages]="eventMessages.animalUuid" />
          <app-form-errors [control]="eventForm.controls.type" [messages]="eventMessages.type" />
          <app-form-errors [control]="eventForm.controls.occurredAt" [messages]="eventMessages.occurredAt" />
          <app-form-errors [control]="eventForm.controls.notes" [messages]="eventMessages.notes" />

          @if (showTransferMetadataError()) {
            <div class="form-alert" role="alert">Para TRANSFERRED necesitás owner origen y destino.</div>
          }

          <div class="form-actions">
            <button mat-flat-button color="accent" type="submit" [disabled]="eventForm.invalid || eventSubmitting()">
              {{ eventSubmitting() ? 'Registrando evento…' : 'Registrar evento operativo' }}
            </button>
          </div>
        </form>
      </mat-card>

      <mat-card appearance="outlined">
        <div class="card-title-row">
          <div>
            <h2>Registrar evento reproductivo</h2>
            <p>Agregado reproductivo separado: servicio, preñez, pérdida y partos con vínculo madre/padre.</p>
          </div>
        </div>

        <form [formGroup]="reproductionEventForm" class="form-grid" (ngSubmit)="submitReproductionEventForm()">
          <mat-form-field appearance="outline">
            <mat-label>UUID animal *</mat-label>
            <input matInput formControlName="animalUuid" required />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Tipo reproductivo *</mat-label>
            <mat-select formControlName="reproductionEventType" required>
              @for (option of reproductionEventTypeOptions; track option.value) {
                <mat-option [value]="option.value">{{ option.label }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Fecha/hora ocurrencia *</mat-label>
            <input matInput type="datetime-local" formControlName="occurredAt" required />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Notas</mat-label>
            <input matInput formControlName="notes" />
          </mat-form-field>

          @if (reproductionEventForm.controls.reproductionEventType.value === 'SERVICE') {
            <mat-form-field appearance="outline">
              <mat-label>Método de servicio *</mat-label>
              <input matInput formControlName="serviceMethod" />
            </mat-form-field>
          }

          @if (reproductionEventForm.controls.reproductionEventType.value === 'PREGNANCY_CONFIRMED') {
            <mat-form-field appearance="outline">
              <mat-label>Fecha confirmación *</mat-label>
              <input matInput type="datetime-local" formControlName="confirmationDate" />
            </mat-form-field>
          }

          @if (reproductionEventForm.controls.reproductionEventType.value === 'PREGNANCY_LOSS') {
            <mat-form-field appearance="outline">
              <mat-label>Motivo de pérdida *</mat-label>
              <input matInput formControlName="lossReason" />
            </mat-form-field>
          }

          @if (reproductionEventForm.controls.reproductionEventType.value === 'BIRTH') {
            <mat-form-field appearance="outline">
              <mat-label>Fecha de parto *</mat-label>
              <input matInput type="datetime-local" formControlName="birthDate" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>UUID madre *</mat-label>
              <input matInput formControlName="motherAnimalUuid" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>UUID padre</mat-label>
              <input matInput formControlName="fatherAnimalUuid" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Cantidad de crías *</mat-label>
              <input matInput type="number" min="0" formControlName="offspringCount" />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>UUIDs crías</mat-label>
              <input matInput formControlName="offspringAnimalUuids" />
              <mat-hint>Separá múltiples UUID con coma.</mat-hint>
            </mat-form-field>
          }

          <app-form-errors [control]="reproductionEventForm.controls.animalUuid" [messages]="reproductionEventMessages.animalUuid" />
          <app-form-errors
            [control]="reproductionEventForm.controls.reproductionEventType"
            [messages]="reproductionEventMessages.reproductionEventType"
          />
          <app-form-errors [control]="reproductionEventForm.controls.occurredAt" [messages]="reproductionEventMessages.occurredAt" />
          <app-form-errors [control]="reproductionEventForm.controls.notes" [messages]="reproductionEventMessages.notes" />

          @if (showReproductionMetadataError()) {
            <div class="form-alert" role="alert">Completá la metadata mínima exigida para este evento reproductivo.</div>
          }

          <div class="form-actions">
            <button mat-flat-button color="accent" type="submit" [disabled]="reproductionEventForm.invalid || reproductionEventSubmitting()">
              {{ reproductionEventSubmitting() ? 'Registrando evento reproductivo…' : 'Registrar evento reproductivo' }}
            </button>
          </div>
        </form>
      </mat-card>

      <mat-card appearance="outlined">
        <div class="card-title-row">
          <div>
            <h2>{{ isEditMode() ? 'Editando ficha animal' : 'Nueva ficha animal' }}</h2>
            <p>Completá owner, estado actual y al menos un visible para registrar la ficha vigente.</p>
          </div>
          @if (isEditMode()) {
            <button mat-stroked-button type="button" (click)="cancelEdit()">Cancelar edición</button>
          }
        </div>

        <form [formGroup]="form" class="form-grid" (ngSubmit)="submitForm()">
          <mat-form-field appearance="outline">
            <mat-label>UUID del ganadero dueño *</mat-label>
            <input matInput formControlName="ownerGanaderoId" required />
            <mat-hint>Usá el ownerGanaderoId vigente del animal.</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Arete</mat-label>
            <input matInput formControlName="arete" />
            <mat-hint>Si existe, debe ser único globalmente.</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Marca</mat-label>
            <input matInput formControlName="marca" />
            <mat-hint>Opcional. Por ahora no exige unicidad global estricta.</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Tatuaje</mat-label>
            <input matInput formControlName="tatuaje" />
            <mat-hint>Opcional. Usalo cuando el rodeo lo necesite.</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Categoría *</mat-label>
            <mat-select formControlName="category" required>
              @for (option of categoryOptions; track option.value) {
                <mat-option [value]="option.value">{{ option.label }}</mat-option>
              }
            </mat-select>
            <mat-hint>Clasificá la ficha vigente del animal.</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Estado *</mat-label>
            <mat-select formControlName="active" required>
              <mat-option [value]="true">Activo</mat-option>
              <mat-option [value]="false">Inactivo</mat-option>
            </mat-select>
            <mat-hint>Indicá si hoy sigue activo en operación.</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Fecha de ingreso *</mat-label>
            <input matInput type="date" formControlName="admissionDate" required />
            <mat-hint>Fecha vigente de admisión/registro del animal.</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Peso (kg)</mat-label>
            <input matInput type="number" min="0" formControlName="weightKg" />
            <mat-hint>Opcional. Guardalo solo si hoy lo tenés confirmado.</mat-hint>
          </mat-form-field>

          <app-form-errors [control]="form.controls.ownerGanaderoId" [messages]="messages.ownerGanaderoId" />
          <app-form-errors [control]="form.controls.category" [messages]="messages.category" />
          <app-form-errors [control]="form.controls.admissionDate" [messages]="messages.admissionDate" />
          <app-form-errors [control]="form.controls.weightKg" [messages]="messages.weightKg" />

          @if (showVisibleIdentifiersError()) {
            <div class="form-alert" role="alert" aria-live="assertive">
              Indicá al menos un identificador visible: arete, marca o tatuaje.
            </div>
          }

          <div class="form-actions">
            <button
              mat-flat-button
              color="primary"
              type="submit"
              [disabled]="form.invalid || submitting()"
            >
              {{ submitLabel() }}
            </button>
          </div>
        </form>
      </mat-card>

      @if (feedbackMessage()) {
        <mat-card appearance="outlined" role="status" aria-live="polite"><p>{{ feedbackMessage() }}</p></mat-card>
      }

      @if (errorMessage()) {
        <mat-card appearance="outlined" role="alert" aria-live="assertive"><p>{{ errorMessage() }}</p></mat-card>
      }

      @if (!animals().length) {
        <mat-card appearance="outlined"><p>Todavía no hay animales registrados.</p></mat-card>
      } @else {
        <div class="cards-grid">
          @for (animal of animals(); track animal.uuid) {
            <mat-card appearance="outlined">
              <h3>{{ primaryVisible(animal) }}</h3>
              <p>UUID: {{ animal.uuid }}</p>
              <p>Owner actual: {{ animal.ownerGanaderoId }}</p>
              <p>{{ animal.category }} · {{ animal.active ? 'Activo' : 'Inactivo' }}</p>
              <p>Ingreso: {{ animal.admissionDate }}</p>
              @if (animal.syncMessage) {
                <p>{{ animal.syncMessage }}</p>
              }
              <button mat-button type="button" (click)="selectAnimalForEvent(animal)">Registrar evento</button>
              <a mat-button [routerLink]="['/admin/visitas-veterinarias']" [queryParams]="{ animalUuid: animal.uuid }">Abrir visitas veterinarias</a>
              <button mat-button type="button" (click)="selectAnimalForReproductionEvent(animal)">Registrar evento reproductivo</button>
              <label class="image-upload">
                <span>Agregar imágenes</span>
                <input type="file" accept="image/jpeg,image/png" multiple (change)="onAnimalImagesSelected(animal, $event)" />
              </label>
              <button mat-button type="button" (click)="startEdit(animal)">Editar ficha</button>

              @if (eventsForAnimal(animal.uuid).length) {
                <div class="event-history">
                  <h4>Historial operativo</h4>
                  <ul>
                    @for (event of eventsForAnimal(animal.uuid); track event.id) {
                      <li>
                        <strong>{{ event.type }}</strong> · {{ event.occurredAt }}
                        @if (event.notes) {
                          <span> · {{ event.notes }}</span>
                        }
                        @if (event.syncMessage) {
                          <span> · {{ event.syncMessage }}</span>
                        }
                      </li>
                    }
                  </ul>
                </div>
              }

              @if (healthEventsForAnimal(animal.uuid).length) {
                <div class="event-history">
                  <h4>Historial sanitario</h4>
                  <ul>
                    @for (healthEvent of healthEventsForAnimal(animal.uuid); track healthEvent.id) {
                      <li>
                        <strong>{{ healthEvent.healthEventType }}</strong> · {{ healthEvent.occurredAt }}
                        @if (healthEvent.treatmentStatus) {
                          <span> · Caso {{ healthEvent.treatmentStatus === 'closed' ? 'cerrado' : 'activo' }}</span>
                        }
                        @if (healthEvent.notes) {
                          <span> · {{ healthEvent.notes }}</span>
                        }
                        @if (healthEvent.syncMessage) {
                          <span> · {{ healthEvent.syncMessage }}</span>
                        }
                      </li>
                    }
                  </ul>
                </div>
              }

              @if (reproductionEventsForAnimal(animal.uuid).length) {
                <div class="event-history">
                  <h4>Historial reproductivo</h4>
                  <ul>
                    @for (reproductionEvent of reproductionEventsForAnimal(animal.uuid); track reproductionEvent.id) {
                      <li>
                        <strong>{{ reproductionEvent.reproductionEventType }}</strong> · {{ reproductionEvent.occurredAt }}
                        @if (reproductionEvent.notes) {
                          <span> · {{ reproductionEvent.notes }}</span>
                        }
                        @if (reproductionEvent.reproductionEventType === 'BIRTH') {
                          <span>
                            · {{ reproductionEvent.metadata['offspringCount'] ?? 0 }} cría(s)
                          </span>
                        }
                        @if (reproductionEvent.syncMessage) {
                          <span> · {{ reproductionEvent.syncMessage }}</span>
                        }
                      </li>
                    }
                  </ul>
                </div>
              }

              @if (imagesForAnimal(animal.uuid).length) {
                <div class="event-history image-history">
                  <h4>Imágenes</h4>
                  <div class="image-grid">
                    @for (image of imagesForAnimal(animal.uuid); track image.id) {
                      <article class="image-card">
                        @if (image.previewUrl) {
                          <img [src]="image.previewUrl" [alt]="image.fileName" />
                        } @else {
                          <div class="image-placeholder">Sin preview</div>
                        }
                        <p><strong>{{ image.fileName }}</strong></p>
                        <p>{{ image.syncState }}</p>
                        @if (image.syncMessage) {
                          <p>{{ image.syncMessage }}</p>
                        }
                      </article>
                    }
                  </div>
                </div>
              }
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

      .card-title-row {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        align-items: start;
        margin-bottom: 1rem;
      }

      .form-grid,
      .cards-grid {
        display: grid;
        gap: 1rem;
      }

      .filter-actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }

      .form-grid {
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      }

      .cards-grid {
        grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      }

      .form-actions,
      .form-alert {
        grid-column: 1 / -1;
      }

      .form-alert {
        color: #b3261e;
        font-weight: 500;
      }

      .image-upload {
        display: inline-flex;
        align-items: center;
        gap: 0.5rem;
      }

      .image-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 0.75rem;
      }

      .image-card img,
      .image-placeholder {
        width: 100%;
        aspect-ratio: 4 / 3;
        object-fit: cover;
        background: #f2f2f2;
      }

      .image-placeholder {
        display: grid;
        place-items: center;
      }

      @media (max-width: 720px) {
        .card-title-row {
          flex-direction: column;
        }
      }
    `,
  ],
})
export class AnimalsPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly animalsService = inject(AnimalsService);
  private readonly animalsImagesService = inject(AnimalsImagesService);
  private readonly animalsEventsService = inject(AnimalsEventsService);
  private readonly animalsHealthEventsService = inject(AnimalsHealthEventsService);
  private readonly animalsReproductionEventsService = inject(AnimalsReproductionEventsService);
  private readonly offlineStatus = inject(OfflineStatusService);

  readonly animals = signal<AnimalItem[]>([]);
  readonly animalEvents = signal<Record<string, AnimalEventItem[]>>({});
  readonly animalImages = signal<Record<string, AnimalImageItem[]>>({});
  readonly animalHealthEvents = signal<Record<string, AnimalHealthEventItem[]>>({});
  readonly animalReproductionEvents = signal<Record<string, AnimalReproductionEventItem[]>>({});
  readonly submitting = signal(false);
  readonly eventSubmitting = signal(false);
  readonly healthEventSubmitting = signal(false);
  readonly reproductionEventSubmitting = signal(false);
  readonly editingUuid = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly feedbackMessage = signal<string | null>(null);
  readonly syncState = this.animalsService.syncState;
  readonly offlineMessage = this.offlineStatus.message;
  readonly offlineMutationsBlocked = computed(() => this.offlineMessage() !== null);
  readonly isEditMode = computed(() => this.editingUuid() !== null);
  readonly submitLabel = computed(() => {
    if (this.submitting()) {
      return this.isEditMode() ? 'Guardando cambios…' : 'Registrando…';
    }

    return this.isEditMode() ? 'Guardar cambios' : 'Registrar animal';
  });
  readonly syncSummary = computed(() => {
    const syncState = this.syncState();
    const lastSyncLabel = syncState.lastSyncAt ? ` · Última sync ${syncState.lastSyncAt}` : '';
    return `${syncState.pending} pendiente(s)${lastSyncLabel}`;
  });
  readonly categoryOptions: Array<{ value: AnimalCategory; label: string }> = [
    { value: 'COW', label: 'Vaca' },
    { value: 'BULL', label: 'Toro' },
    { value: 'CALF', label: 'Ternero/a' },
    { value: 'HEIFER', label: 'Vaquillona' },
  ];
  readonly eventTypeOptions: Array<{ value: AnimalEventItem['type']; label: string }> = [
    { value: 'SOLD', label: 'Vendido' },
    { value: 'DECEASED', label: 'Fallecido' },
    { value: 'LOST', label: 'Perdido' },
    { value: 'TRANSFERRED', label: 'Transferido' },
    { value: 'OBSERVATION', label: 'Observación' },
  ];
  readonly healthEventTypeOptions: Array<{ value: AnimalHealthEventItem['healthEventType']; label: string }> = [
    { value: 'VACCINATION', label: 'Vacunación' },
    { value: 'DEWORMING', label: 'Desparasitación' },
    { value: 'DISEASE_REPORTED', label: 'Enfermedad reportada' },
    { value: 'TREATMENT_STARTED', label: 'Tratamiento iniciado' },
    { value: 'TREATMENT_FOLLOW_UP', label: 'Seguimiento de tratamiento' },
    { value: 'TREATMENT_CLOSED', label: 'Tratamiento cerrado' },
  ];
  readonly reproductionEventTypeOptions: Array<{ value: AnimalReproductionEventItem['reproductionEventType']; label: string }> = [
    { value: 'SERVICE', label: 'Servicio' },
    { value: 'PREGNANCY_CONFIRMED', label: 'Preñez confirmada' },
    { value: 'PREGNANCY_LOSS', label: 'Pérdida de preñez' },
    { value: 'BIRTH', label: 'Parto' },
  ];
  readonly form = this.formBuilder.group(
    {
      ownerGanaderoId: ['', [Validators.required]],
      arete: [''],
      marca: [''],
      tatuaje: [''],
      category: ['COW' as AnimalCategory, [Validators.required]],
      active: [true, [Validators.required]],
      admissionDate: ['', [Validators.required]],
      weightKg: [null as number | null, [Validators.min(0)]],
    },
    {
      validators: [atLeastOneVisibleIdentifierValidator],
    }
  );
  readonly filtersForm = this.formBuilder.group({
    visible: [''],
    ownerGanaderoId: [''],
    category: [null as AnimalCategory | null],
    active: [null as 'true' | 'false' | null],
  });
  readonly eventForm = this.formBuilder.group(
    {
      animalUuid: ['', [Validators.required]],
      type: ['OBSERVATION' as AnimalEventItem['type'], [Validators.required]],
      occurredAt: ['', [Validators.required]],
      notes: ['', [Validators.maxLength(500)]],
      reasonCode: [''],
      fromOwnerGanaderoId: [''],
      toOwnerGanaderoId: [''],
    },
    { validators: [transferMetadataValidator] }
  );
  readonly healthEventForm = this.formBuilder.group(
    {
      animalUuid: ['', [Validators.required]],
      healthEventType: ['VACCINATION' as AnimalHealthEventItem['healthEventType'], [Validators.required]],
      occurredAt: ['', [Validators.required]],
      notes: ['', [Validators.maxLength(500)]],
      productName: [''],
      batchLot: [''],
      nextDueAt: [''],
      diagnosisCode: [''],
      treatmentCaseId: [''],
    },
    { validators: [healthMetadataValidator] }
  );
  readonly reproductionEventForm = this.formBuilder.group(
    {
      animalUuid: ['', [Validators.required]],
      reproductionEventType: ['SERVICE' as AnimalReproductionEventItem['reproductionEventType'], [Validators.required]],
      occurredAt: ['', [Validators.required]],
      notes: ['', [Validators.maxLength(500)]],
      serviceMethod: [''],
      confirmationDate: [''],
      lossReason: [''],
      birthDate: [''],
      motherAnimalUuid: [''],
      fatherAnimalUuid: [''],
      offspringCount: [0, [Validators.min(0)]],
      offspringAnimalUuids: [''],
    },
    { validators: [reproductionMetadataValidator] }
  );

  readonly messages = {
    ownerGanaderoId: { required: 'Informá el UUID del ganadero responsable.' },
    category: { required: 'Seleccioná la categoría actual del animal.' },
    admissionDate: { required: 'Ingresá la fecha de ingreso vigente.' },
    weightKg: { min: 'El peso no puede ser negativo.' },
  };
  readonly eventMessages = {
    animalUuid: { required: 'Seleccioná el animal del evento.' },
    type: { required: 'Elegí el tipo de evento.' },
    occurredAt: { required: 'Informá cuándo ocurrió el evento.' },
    notes: { maxlength: 'Las notas admiten hasta 500 caracteres.' },
  };
  readonly healthEventMessages = {
    animalUuid: { required: 'Seleccioná el animal del evento sanitario.' },
    healthEventType: { required: 'Elegí el tipo sanitario.' },
    occurredAt: { required: 'Informá cuándo ocurrió el evento sanitario.' },
    notes: { maxlength: 'Las notas sanitarias admiten hasta 500 caracteres.' },
  };
  readonly reproductionEventMessages = {
    animalUuid: { required: 'Seleccioná el animal del evento reproductivo.' },
    reproductionEventType: { required: 'Elegí el tipo reproductivo.' },
    occurredAt: { required: 'Informá cuándo ocurrió el evento reproductivo.' },
    notes: { maxlength: 'Las notas reproductivas admiten hasta 500 caracteres.' },
  };

  constructor() {
    this.loadAnimals();
  }

  submitForm() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.form.updateValueAndValidity();
      return;
    }

    this.submitting.set(true);
    this.errorMessage.set(null);
    this.feedbackMessage.set(null);

    const payload = toAnimalMutationPayload(this.form.getRawValue());
    const request$ = this.editingUuid()
      ? this.animalsService.updateAnimal(this.editingUuid()!, payload)
      : this.animalsService.createAnimal(payload);

    request$.pipe(finalize(() => this.submitting.set(false))).subscribe({
      next: (result) => {
        if (result.outcome === 'blocked') {
          this.errorMessage.set(result.message);
          return;
        }

        this.feedbackMessage.set(result.message);
        this.errorMessage.set(null);
        this.cancelEdit();
        this.loadAnimals();
      },
      error: () => this.errorMessage.set('No pudimos guardar la ficha animal.'),
    });
  }

  startEdit(animal: AnimalItem) {
    this.editingUuid.set(animal.uuid);
    this.errorMessage.set(null);
    this.feedbackMessage.set(null);
    this.form.reset({
      ownerGanaderoId: animal.ownerGanaderoId,
      arete: animal.arete ?? '',
      marca: animal.marca ?? '',
      tatuaje: animal.tatuaje ?? '',
      category: animal.category,
      active: animal.active,
      admissionDate: animal.admissionDate,
      weightKg: animal.weightKg,
    });
  }

  selectAnimalForEvent(animal: AnimalItem) {
    this.eventForm.patchValue({
      animalUuid: animal.uuid,
      type: 'OBSERVATION',
      occurredAt: currentLocalDateTimeInput(),
      notes: '',
      reasonCode: '',
      fromOwnerGanaderoId: animal.ownerGanaderoId,
      toOwnerGanaderoId: '',
    });
  }

  selectAnimalForHealthEvent(animal: AnimalItem) {
    this.healthEventForm.patchValue({
      animalUuid: animal.uuid,
      healthEventType: 'VACCINATION',
      occurredAt: currentLocalDateTimeInput(),
      notes: '',
      productName: '',
      batchLot: '',
      nextDueAt: '',
      diagnosisCode: '',
      treatmentCaseId: '',
    });
  }

  selectAnimalForReproductionEvent(animal: AnimalItem) {
    this.reproductionEventForm.patchValue({
      animalUuid: animal.uuid,
      reproductionEventType: 'SERVICE',
      occurredAt: currentLocalDateTimeInput(),
      notes: '',
      serviceMethod: '',
      confirmationDate: '',
      lossReason: '',
      birthDate: currentLocalDateTimeInput(),
      motherAnimalUuid: animal.uuid,
      fatherAnimalUuid: '',
      offspringCount: 0,
      offspringAnimalUuids: '',
    });
  }

  submitEventForm() {
    if (this.eventForm.invalid) {
      this.eventForm.markAllAsTouched();
      this.eventForm.updateValueAndValidity();
      return;
    }

    this.eventSubmitting.set(true);
    this.errorMessage.set(null);
    this.feedbackMessage.set(null);

    const value = this.eventForm.getRawValue();
    this.animalsEventsService
      .createEvent({
        animalUuid: value.animalUuid ?? '',
        type: (value.type ?? 'OBSERVATION') as AnimalEventItem['type'],
        occurredAt: value.occurredAt ?? '',
        notes: value.notes,
        metadata: {
          reasonCode: normalizeOptionalText(value.reasonCode) ?? undefined,
          fromOwnerGanaderoId: normalizeOptionalText(value.fromOwnerGanaderoId) ?? undefined,
          toOwnerGanaderoId: normalizeOptionalText(value.toOwnerGanaderoId) ?? undefined,
        },
      })
      .pipe(finalize(() => this.eventSubmitting.set(false)))
      .subscribe({
        next: async (result) => {
          if (result.outcome === 'blocked') {
            this.errorMessage.set(result.message);
            return;
          }

          this.feedbackMessage.set(result.message);
          await this.loadHistories(this.animals());
          this.loadAnimals(this.buildFilters());
        },
        error: () => this.errorMessage.set('No pudimos registrar el evento animal.'),
      });
  }

  submitHealthEventForm() {
    if (this.healthEventForm.invalid) {
      this.healthEventForm.markAllAsTouched();
      this.healthEventForm.updateValueAndValidity();
      return;
    }

    this.healthEventSubmitting.set(true);
    this.errorMessage.set(null);
    this.feedbackMessage.set(null);

    const value = this.healthEventForm.getRawValue();
    this.animalsHealthEventsService
      .createEvent({
        animalUuid: value.animalUuid ?? '',
        healthEventType: (value.healthEventType ?? 'VACCINATION') as AnimalHealthEventItem['healthEventType'],
        occurredAt: value.occurredAt ?? '',
        notes: value.notes,
        metadata: {
          productName: normalizeOptionalText(value.productName) ?? undefined,
          batchLot: normalizeOptionalText(value.batchLot) ?? undefined,
          nextDueAt: normalizeOptionalText(value.nextDueAt) ? normalizeOccurredAtValue(value.nextDueAt!) : undefined,
          diagnosisCode: normalizeOptionalText(value.diagnosisCode) ?? undefined,
          treatmentCaseId: normalizeOptionalText(value.treatmentCaseId) ?? undefined,
        },
      })
      .pipe(finalize(() => this.healthEventSubmitting.set(false)))
      .subscribe({
        next: async (result) => {
          if (result.outcome === 'blocked') {
            this.errorMessage.set(result.message);
            return;
          }

          this.feedbackMessage.set(result.message);
          await this.loadHistories(this.animals());
        },
        error: () => this.errorMessage.set('No pudimos registrar el evento sanitario.'),
      });
  }

  submitReproductionEventForm() {
    if (this.reproductionEventForm.invalid) {
      this.reproductionEventForm.markAllAsTouched();
      this.reproductionEventForm.updateValueAndValidity();
      return;
    }

    this.reproductionEventSubmitting.set(true);
    this.errorMessage.set(null);
    this.feedbackMessage.set(null);

    const value = this.reproductionEventForm.getRawValue();
    this.animalsReproductionEventsService
      .createEvent({
        animalUuid: value.animalUuid ?? '',
        reproductionEventType: (value.reproductionEventType ?? 'SERVICE') as AnimalReproductionEventItem['reproductionEventType'],
        occurredAt: value.occurredAt ?? '',
        notes: value.notes,
        metadata: buildReproductionMetadata(value),
      })
      .pipe(finalize(() => this.reproductionEventSubmitting.set(false)))
      .subscribe({
        next: async (result) => {
          if (result.outcome === 'blocked') {
            this.errorMessage.set(result.message);
            return;
          }

          this.feedbackMessage.set(result.message);
          await this.loadHistories(this.animals());
          this.loadAnimals(this.buildFilters());
        },
        error: () => this.errorMessage.set('No pudimos registrar el evento reproductivo.'),
      });
  }

  cancelEdit() {
    this.editingUuid.set(null);
    this.form.reset({
      ownerGanaderoId: '',
      arete: '',
      marca: '',
      tatuaje: '',
      category: 'COW',
      active: true,
      admissionDate: '',
      weightKg: null,
    });
  }

  applyFilters() {
    this.loadAnimals(this.buildFilters());
  }

  clearFilters() {
    this.filtersForm.reset({
      visible: '',
      ownerGanaderoId: '',
      category: null,
      active: null,
    });
    this.loadAnimals();
  }

  showVisibleIdentifiersError() {
    return this.form.touched && this.form.hasError('visibleIdentifierRequired');
  }

  primaryVisible(animal: AnimalItem) {
    return animal.arete ?? animal.marca ?? animal.tatuaje ?? 'Sin visible informado';
  }

  eventsForAnimal(animalUuid: string) {
    return this.animalEvents()[animalUuid] ?? [];
  }

  imagesForAnimal(animalUuid: string) {
    return this.animalImages()[animalUuid] ?? [];
  }

  healthEventsForAnimal(animalUuid: string) {
    return this.animalHealthEvents()[animalUuid] ?? [];
  }

  reproductionEventsForAnimal(animalUuid: string) {
    return this.animalReproductionEvents()[animalUuid] ?? [];
  }

  showTransferMetadataError() {
    return this.eventForm.touched && this.eventForm.hasError('transferMetadataRequired');
  }

  showHealthMetadataError() {
    return this.healthEventForm.touched && this.healthEventForm.hasError('healthMetadataRequired');
  }

  showReproductionMetadataError() {
    return this.reproductionEventForm.touched && this.reproductionEventForm.hasError('reproductionMetadataRequired');
  }

  isTreatmentHealthEvent() {
    const currentType = this.healthEventForm.controls.healthEventType.value;
    return currentType === 'TREATMENT_STARTED' || currentType === 'TREATMENT_FOLLOW_UP' || currentType === 'TREATMENT_CLOSED';
  }

  onAnimalImagesSelected(animal: AnimalItem, event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    if (!files.length) {
      return;
    }

    this.animalsImagesService.addImages(animal.uuid, files).subscribe({
      next: async (result) => {
        if (result.outcome === 'blocked') {
          this.errorMessage.set(result.message);
          return;
        }

        this.feedbackMessage.set(result.message);
        this.errorMessage.set(null);
        input.value = '';
        await this.loadHistories(this.animals());
      },
      error: () => this.errorMessage.set('No pudimos encolar las imágenes del animal.'),
    });
  }

  private buildFilters(): AnimalListFilters {
    const formValue = this.filtersForm.getRawValue();

    return {
      visible: formValue.visible?.trim() || undefined,
      ownerGanaderoId: formValue.ownerGanaderoId?.trim() || undefined,
      category: formValue.category ?? undefined,
      active: formValue.active === null ? undefined : formValue.active === 'true',
    };
  }

  private loadAnimals(filters: AnimalListFilters = {}) {
    this.animalsService.listAnimals(filters).subscribe({
      next: (animals) => {
        this.animals.set(animals);
        void this.loadHistories(animals);
      },
      error: () => {
        this.animals.set([]);
        this.animalEvents.set({});
        this.animalImages.set({});
        this.animalHealthEvents.set({});
        this.animalReproductionEvents.set({});
        this.errorMessage.set('No pudimos cargar los animales.');
      },
    });
  }

  private async loadHistories(animals: AnimalItem[]) {
    const histories = await Promise.all(
      animals.map(async (animal) => {
        const [events, images, healthEvents, reproductionEvents] = await Promise.all([
          firstValueFrom(this.animalsEventsService.listEvents(animal.uuid, {})),
          firstValueFrom(this.animalsImagesService.listImages(animal.uuid)),
          firstValueFrom(this.animalsHealthEventsService.listEvents(animal.uuid, {})),
          firstValueFrom(this.animalsReproductionEventsService.listEvents(animal.uuid, {})),
        ]);
        return [animal.uuid, events, images, healthEvents, reproductionEvents] as const;
      })
    );
    this.animalEvents.set(Object.fromEntries(histories.map(([uuid, events]) => [uuid, events])));
    this.animalImages.set(Object.fromEntries(histories.map(([uuid, _events, images]) => [uuid, images])));
    this.animalHealthEvents.set(Object.fromEntries(histories.map(([uuid, _events, _images, healthEvents]) => [uuid, healthEvents])));
    this.animalReproductionEvents.set(
      Object.fromEntries(histories.map(([uuid, _events, _images, _healthEvents, reproductionEvents]) => [uuid, reproductionEvents]))
    );
  }
}

const atLeastOneVisibleIdentifierValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const formValue = control.value as {
    arete?: string | null;
    marca?: string | null;
    tatuaje?: string | null;
  };

  return hasMeaningfulVisible(formValue?.arete) || hasMeaningfulVisible(formValue?.marca) || hasMeaningfulVisible(formValue?.tatuaje)
    ? null
    : { visibleIdentifierRequired: true };
};

function hasMeaningfulVisible(value: string | null | undefined) {
  return Boolean(value?.trim());
}

const transferMetadataValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const formValue = control.value as {
    type?: AnimalEventItem['type'];
    fromOwnerGanaderoId?: string | null;
    toOwnerGanaderoId?: string | null;
  };

  if (formValue?.type !== 'TRANSFERRED') {
    return null;
  }

  return hasMeaningfulVisible(formValue.fromOwnerGanaderoId) && hasMeaningfulVisible(formValue.toOwnerGanaderoId)
    ? null
    : { transferMetadataRequired: true };
};

const healthMetadataValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const formValue = control.value as {
    healthEventType?: AnimalHealthEventItem['healthEventType'];
    notes?: string | null;
    productName?: string | null;
    diagnosisCode?: string | null;
    treatmentCaseId?: string | null;
  };

  const productName = hasMeaningfulVisible(formValue.productName);
  const diagnosisCode = hasMeaningfulVisible(formValue.diagnosisCode);
  const treatmentCaseId = hasMeaningfulVisible(formValue.treatmentCaseId);
  const notes = hasMeaningfulVisible(formValue.notes);

  switch (formValue.healthEventType) {
    case 'VACCINATION':
    case 'DEWORMING':
      return productName ? null : { healthMetadataRequired: true };
    case 'DISEASE_REPORTED':
      return diagnosisCode || notes ? null : { healthMetadataRequired: true };
    case 'TREATMENT_STARTED':
    case 'TREATMENT_FOLLOW_UP':
    case 'TREATMENT_CLOSED':
      return productName && treatmentCaseId && notes ? null : { healthMetadataRequired: true };
    default:
      return null;
  }
};

const reproductionMetadataValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const formValue = control.value as {
    reproductionEventType?: AnimalReproductionEventItem['reproductionEventType'];
    serviceMethod?: string | null;
    confirmationDate?: string | null;
    lossReason?: string | null;
    birthDate?: string | null;
    motherAnimalUuid?: string | null;
    offspringCount?: number | null;
    offspringAnimalUuids?: string | null;
  };

  switch (formValue.reproductionEventType) {
    case 'SERVICE':
      return hasMeaningfulVisible(formValue.serviceMethod) ? null : { reproductionMetadataRequired: true };
    case 'PREGNANCY_CONFIRMED':
      return hasMeaningfulVisible(formValue.confirmationDate) ? null : { reproductionMetadataRequired: true };
    case 'PREGNANCY_LOSS':
      return hasMeaningfulVisible(formValue.lossReason) ? null : { reproductionMetadataRequired: true };
    case 'BIRTH': {
      const offspringCount = Number(formValue.offspringCount ?? 0);
      const offspringAnimalUuids = parseCommaSeparatedUuids(formValue.offspringAnimalUuids);
      return hasMeaningfulVisible(formValue.birthDate) &&
        hasMeaningfulVisible(formValue.motherAnimalUuid) &&
        offspringCount >= 0 &&
        (offspringCount === 0 || offspringAnimalUuids.length === offspringCount)
        ? null
        : { reproductionMetadataRequired: true };
    }
    default:
      return null;
  }
};

function toAnimalMutationPayload(formValue: {
  ownerGanaderoId?: string | null;
  arete?: string | null;
  marca?: string | null;
  tatuaje?: string | null;
  category?: AnimalCategory | null;
  active?: boolean | null;
  admissionDate?: string | null;
  weightKg?: number | string | null;
}): AnimalMutationPayload {
  return {
    ownerGanaderoId: formValue.ownerGanaderoId?.trim() ?? '',
    arete: normalizeOptionalText(formValue.arete),
    marca: normalizeOptionalText(formValue.marca),
    tatuaje: normalizeOptionalText(formValue.tatuaje),
    category: (formValue.category ?? 'COW') as AnimalCategory,
    active: Boolean(formValue.active),
    admissionDate: formValue.admissionDate ?? '',
    weightKg: normalizeWeight(formValue.weightKg),
  };
}

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function normalizeOccurredAtValue(value: string) {
  return value.includes('T') && !value.endsWith('Z') ? `${value}:00.000Z`.replace('T', 'T') : value;
}

function buildReproductionMetadata(formValue: {
  reproductionEventType?: AnimalReproductionEventItem['reproductionEventType'] | null;
  serviceMethod?: string | null;
  confirmationDate?: string | null;
  lossReason?: string | null;
  birthDate?: string | null;
  motherAnimalUuid?: string | null;
  fatherAnimalUuid?: string | null;
  offspringCount?: number | null;
  offspringAnimalUuids?: string | null;
}) {
  switch (formValue.reproductionEventType) {
    case 'SERVICE':
      return { serviceMethod: normalizeOptionalText(formValue.serviceMethod) ?? undefined };
    case 'PREGNANCY_CONFIRMED':
      return { confirmationDate: normalizeOptionalText(formValue.confirmationDate) ? normalizeOccurredAtValue(formValue.confirmationDate!) : undefined };
    case 'PREGNANCY_LOSS':
      return { lossReason: normalizeOptionalText(formValue.lossReason) ?? undefined };
    case 'BIRTH':
      return buildBirthMetadata({
        birthDate: formValue.birthDate ?? '',
        offspringCount: Number(formValue.offspringCount ?? 0),
        motherAnimalUuid: formValue.motherAnimalUuid ?? '',
        fatherAnimalUuid: formValue.fatherAnimalUuid,
        offspringAnimalUuids: parseCommaSeparatedUuids(formValue.offspringAnimalUuids),
      });
    default:
      return {};
  }
}

function parseCommaSeparatedUuids(value: string | null | undefined) {
  return (value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function currentLocalDateTimeInput() {
  return new Date().toISOString().slice(0, 16);
}

function normalizeWeight(value: number | string | null | undefined) {
  if (value === '' || value === null || value === undefined) {
    return null;
  }

  return typeof value === 'number' ? value : Number(value);
}

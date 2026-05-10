import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, type AbstractControl, type ValidationErrors, type ValidatorFn } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { finalize, firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/data-access/auth.service';
import { OfflineStatusService } from '../../../core/offline/offline-status.service';
import {
  DataTableComponent,
  DATA_TABLE_FILTER_TYPE,
  type DataTableAction,
  type DataTableColumn,
  type DataTableRowActionEvent,
} from '../../../shared/ui/data-table/data-table.component';
import { AnimalsEventsService, type AnimalEventItem } from './data-access/animals-events.service';
import { AnimalsImagesService, type AnimalImageItem } from './data-access/animals-images.service';
import {
  AnimalsReproductionEventsService,
  buildBirthMetadata,
  type AnimalReproductionEventItem,
} from './data-access/animals-reproduction-events.service';
import {
  ANIMAL_CATEGORY,
  ANIMAL_CATEGORY_OPTIONS,
  ANIMAL_SEX,
  ANIMAL_SEX_OPTIONS,
  AnimalsService,
  type AnimalCategory,
  type AnimalItem,
  type AnimalMutationPayload,
} from './data-access/animals.service';
import {
  ANIMAL_DIALOG_MODE,
  AnimalFormDialogComponent,
  type AnimalDialogResult,
  type AnimalOwnerOption,
} from './animal-form-dialog.component';
import { GanaderosService } from '../ganaderos/data-access/ganaderos.service';

const ANIMAL_TABLE_ACTION = {
  OPERATIVE_EVENT: 'operative-event',
  REPRODUCTIVE_EVENT: 'reproductive-event',
  CASTRATION: 'castration-event',
  IMAGES: 'images',
  VIEW_EDIT: 'view-edit',
} as const;

@Component({
  selector: 'app-animals-page',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, DataTableComponent],
  template: `
    <section class="admin-page">
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
        @if (syncState().manualRefreshRequired) {
          <p>Necesitás refrescar manualmente la lista para resolver un conflicto remoto.</p>
        }
      </mat-card>

      <div class="toolbar-actions">
        <button mat-flat-button color="primary" type="button" (click)="openCreateDialog()">Nuevo animal</button>
      </div>

      @if (feedbackMessage()) {
        <mat-card appearance="outlined" role="status" aria-live="polite"><p>{{ feedbackMessage() }}</p></mat-card>
      }

      @if (errorMessage()) {
        <mat-card appearance="outlined" role="alert" aria-live="assertive"><p>{{ errorMessage() }}</p></mat-card>
      } @else if (!animals().length) {
        <mat-card appearance="outlined"><p>Todavía no hay animales registrados.</p></mat-card>
      } @else {
        <mat-card appearance="outlined">
          <app-data-table
            [columns]="columns"
            [data]="animals()"
            [filters]="filters()"
            [actions]="actions"
            (filterChange)="filters.set($event)"
            (rowAction)="handleRowAction($event)"
          />
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

      .toolbar-actions {
        display: grid;
        gap: 1rem;
      }
    `,
  ],
})
export class AnimalsPageComponent {
  private readonly animalsService = inject(AnimalsService);
  private readonly animalsEventsService = inject(AnimalsEventsService);
  private readonly animalsReproductionEventsService = inject(AnimalsReproductionEventsService);
  private readonly animalsImagesService = inject(AnimalsImagesService);
  private readonly ganaderosService = inject(GanaderosService);
  private readonly authService = inject(AuthService);
  private readonly offlineStatus = inject(OfflineStatusService);
  private readonly dialog = inject(MatDialog);

  readonly animals = signal<AnimalItem[]>([]);
  readonly ownerOptions = signal<AnimalOwnerOption[]>([]);
  readonly ownerOptionsError = signal<string | null>(null);
  readonly imageTimelines = signal<Record<string, AnimalImageItem[]>>({});
  readonly errorMessage = signal<string | null>(null);
  readonly feedbackMessage = signal<string | null>(null);
  readonly filters = signal<Record<string, string>>({});
  readonly syncState = this.animalsService.syncState;
  readonly offlineMessage = this.offlineStatus.message;
  readonly syncSummary = computed(() => {
    const syncState = this.syncState();
    const lastSyncLabel = syncState.lastSyncAt ? ` · Última sync ${syncState.lastSyncAt}` : '';
    return `${syncState.pending} pendiente(s)${lastSyncLabel}`;
  });
  readonly columns: DataTableColumn[] = [
    { key: 'arete', label: 'Arete', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.TEXT },
    { key: 'marca', label: 'Marca', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.TEXT },
    { key: 'tatuaje', label: 'Tatuaje', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.TEXT },
    {
      key: 'sex',
      label: 'Sexo',
      sortable: true,
      filterType: DATA_TABLE_FILTER_TYPE.SELECT,
      filterOptions: [...ANIMAL_SEX_OPTIONS],
      formatter: (value) => String(value ?? '—'),
    },
    {
      key: 'category',
      label: 'Categoría',
      sortable: true,
      filterType: DATA_TABLE_FILTER_TYPE.SELECT,
      filterOptions: [...ANIMAL_CATEGORY_OPTIONS],
      formatter: (value) => String(value ?? '—'),
    },
    { key: 'birthDate', label: 'Fecha de nacimiento', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.DATE },
    { key: 'admissionDate', label: 'Fecha de ingreso', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.DATE },
    {
      key: 'active',
      label: 'Estado',
      sortable: true,
      filterType: DATA_TABLE_FILTER_TYPE.SELECT,
      filterOptions: [
        { label: 'Activo', value: 'true' },
        { label: 'Inactivo', value: 'false' },
      ],
      formatter: (value) => (value === true ? 'Activo' : 'Inactivo'),
    },
  ];
  readonly actions: DataTableAction[] = [
    { id: ANIMAL_TABLE_ACTION.OPERATIVE_EVENT, label: 'Evento operativo', icon: 'event' },
    { id: ANIMAL_TABLE_ACTION.REPRODUCTIVE_EVENT, label: 'Evento reproductivo', icon: 'child_friendly' },
    { id: ANIMAL_TABLE_ACTION.CASTRATION, label: 'Castración', icon: 'content_cut' },
    { id: ANIMAL_TABLE_ACTION.IMAGES, label: 'Imágenes', icon: 'photo_library' },
    { id: ANIMAL_TABLE_ACTION.VIEW_EDIT, label: 'Ver/Editar ficha', icon: 'visibility' },
  ];

  constructor() {
    this.loadAnimals();
    this.loadOwnerOptionsIfNeeded();
  }

  openCreateDialog() {
    if (!this.canOpenAnimalDialog()) {
      return;
    }

    this.dialog
      .open(AnimalFormDialogComponent, {
        width: 'min(72rem, 98vw)',
        maxWidth: '98vw',
        maxHeight: '92vh',
        data: this.buildAnimalDialogData({ mode: ANIMAL_DIALOG_MODE.CREATE }),
      })
      .afterClosed()
      .subscribe((result: AnimalDialogResult | undefined) => {
        if (!result) {
          return;
        }

        this.submitAnimalMutation(() => this.animalsService.createAnimal(result));
      });
  }

  handleRowAction(event: DataTableRowActionEvent) {
    const animal = event.row as AnimalItem;

    switch (event.actionId) {
      case ANIMAL_TABLE_ACTION.OPERATIVE_EVENT:
        this.openOperativeEventDialog(animal);
        return;
      case ANIMAL_TABLE_ACTION.REPRODUCTIVE_EVENT:
        this.openReproductionEventDialog(animal);
        return;
      case ANIMAL_TABLE_ACTION.CASTRATION:
        this.openOperativeEventDialog(animal, 'CASTRATION');
        return;
      case ANIMAL_TABLE_ACTION.IMAGES:
        this.openImagesDialog(animal);
        return;
      case ANIMAL_TABLE_ACTION.VIEW_EDIT:
        this.openEditDialog(animal);
        return;
      default:
        return;
    }
  }

  private openEditDialog(animal: AnimalItem) {
    if (!this.canOpenAnimalDialog()) {
      return;
    }

    this.dialog
      .open(AnimalFormDialogComponent, {
        width: 'min(72rem, 98vw)',
        maxWidth: '98vw',
        maxHeight: '92vh',
        data: this.buildAnimalDialogData({ mode: ANIMAL_DIALOG_MODE.EDIT, animal }),
      })
      .afterClosed()
      .subscribe((result: AnimalDialogResult | undefined) => {
        if (!result) {
          return;
        }

        this.submitAnimalMutation(() => this.animalsService.updateAnimal(animal.uuid, result));
      });
  }

  private openOperativeEventDialog(animal: AnimalItem, lockedType?: AnimalEventItem['type']) {
    this.dialog
      .open(AnimalOperativeEventDialogComponent, {
        data: {
          animal,
          lockedType,
        },
      })
      .afterClosed()
      .subscribe((result: OperativeEventDialogResult | undefined) => {
        if (!result) {
          return;
        }

        const request$ = result.type === 'CASTRATION'
          ? this.animalsEventsService.createCastrationEvent(animal.uuid, {
              occurredAt: result.occurredAt,
              notes: result.notes,
              metadata: result.metadata,
            })
          : this.animalsEventsService.createEvent({
              animalUuid: animal.uuid,
              type: result.type,
              occurredAt: result.occurredAt,
              notes: result.notes,
              metadata: result.metadata,
            });

        this.submitGenericMutation(request$, true);
      });
  }

  private openReproductionEventDialog(animal: AnimalItem) {
    this.dialog
      .open(AnimalReproductionEventDialogComponent, { data: { animal } })
      .afterClosed()
      .subscribe((result: ReproductionEventDialogResult | undefined) => {
        if (!result) {
          return;
        }

        this.submitGenericMutation(
          this.animalsReproductionEventsService.createEvent({
            animalUuid: animal.uuid,
            reproductionEventType: result.reproductionEventType,
            occurredAt: result.occurredAt,
            notes: result.notes,
            metadata: result.metadata,
          }),
          true,
        );
      });
  }

  private openImagesDialog(animal: AnimalItem) {
    firstValueFrom(this.animalsImagesService.listImages(animal.uuid))
      .then((images) => {
        this.dialog
          .open(AnimalImagesDialogComponent, {
            data: {
              animal,
              images,
            },
          })
          .afterClosed()
          .subscribe((files: File[] | undefined) => {
            if (!files?.length) {
              return;
            }

            this.submitGenericMutation(this.animalsImagesService.addImages(animal.uuid, files), false);
          });
      })
      .catch(() => {
        this.errorMessage.set('No pudimos cargar las imágenes del animal.');
      });
  }

  private submitAnimalMutation(requestFactory: () => ReturnType<AnimalsService['createAnimal']>) {
    this.errorMessage.set(null);
    this.feedbackMessage.set(null);
    requestFactory().subscribe({
      next: (result) => {
        if (result.outcome === 'blocked') {
          this.errorMessage.set(result.message);
          return;
        }

        this.feedbackMessage.set(result.message);
        this.loadAnimals();
      },
      error: () => this.errorMessage.set('No pudimos guardar la ficha animal.'),
    });
  }

  private submitGenericMutation(
    request$: ReturnType<AnimalsEventsService['createEvent']> | ReturnType<AnimalsEventsService['createCastrationEvent']> | ReturnType<AnimalsReproductionEventsService['createEvent']> | ReturnType<AnimalsImagesService['addImages']>,
    reloadAnimals: boolean,
  ) {
    this.errorMessage.set(null);
    this.feedbackMessage.set(null);
    request$.subscribe({
      next: (result) => {
        if (result.outcome === 'blocked') {
          this.errorMessage.set(result.message);
          return;
        }

        this.feedbackMessage.set(result.message);
        if (reloadAnimals) {
          this.loadAnimals();
        } else {
          void this.loadImageTimelines(this.animals());
        }
      },
      error: () => this.errorMessage.set('No pudimos completar la acción del animal.'),
    });
  }

  private loadAnimals() {
    this.animalsService.listAnimals().subscribe({
      next: (animals) => {
        this.animals.set(animals);
        void this.loadImageTimelines(animals);
      },
      error: () => {
        this.animals.set([]);
        this.imageTimelines.set({});
        this.errorMessage.set('No pudimos cargar los animales.');
      },
    });
  }

  private async loadImageTimelines(animals: AnimalItem[]) {
    const entries = await Promise.all(
      animals.map(async (animal) => [animal.uuid, await firstValueFrom(this.animalsImagesService.listImages(animal.uuid))] as const),
    );
    this.imageTimelines.set(Object.fromEntries(entries));
  }

  private buildAnimalDialogData(base: { mode: typeof ANIMAL_DIALOG_MODE.CREATE | typeof ANIMAL_DIALOG_MODE.EDIT; animal?: AnimalItem }) {
    return {
      ...base,
      currentUserRole: this.authService.currentUser()?.role ?? 'GANADERO',
      ownerOptions: this.ownerOptions(),
    };
  }

  private loadOwnerOptionsIfNeeded() {
    if (this.authService.currentUser()?.role !== 'ADMIN') {
      return;
    }

    this.ganaderosService.listGanaderos().subscribe({
      next: (ganaderos) => {
        this.ownerOptions.set(
          ganaderos.map((ganadero) => ({
            id: ganadero.id,
            label: `${ganadero.name} · ${ganadero.businessIdentifier}`,
          }))
        );
        this.ownerOptionsError.set(null);
      },
      error: () => {
        this.ownerOptions.set([]);
        this.ownerOptionsError.set('No pudimos cargar el listado de ganaderos para asignar el propietario.');
      },
    });
  }

  private canOpenAnimalDialog() {
    if (this.authService.currentUser()?.role !== 'ADMIN') {
      return true;
    }

    if (this.ownerOptions().length > 0) {
      return true;
    }

    this.errorMessage.set(this.ownerOptionsError() ?? 'Necesitás al menos un ganadero registrado para asignar el animal.');
    return false;
  }
}

interface OperativeEventDialogData {
  animal: AnimalItem;
  lockedType?: AnimalEventItem['type'];
}

interface OperativeEventDialogResult {
  type: AnimalEventItem['type'];
  occurredAt: string;
  notes?: string | null;
  metadata: {
    reasonCode?: string;
    fromOwnerGanaderoId?: string;
    toOwnerGanaderoId?: string;
  };
}

@Component({
  selector: 'app-animal-operative-event-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>{{ title() }}</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline">
          <mat-label>Tipo</mat-label>
          <mat-select formControlName="type" [disabled]="typeLocked()">
            @for (option of eventTypeOptions; track option.value) {
              <mat-option [value]="option.value">{{ option.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Fecha/hora ocurrencia</mat-label>
          <input matInput type="datetime-local" formControlName="occurredAt" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Notas</mat-label>
          <input matInput formControlName="notes" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Reason code</mat-label>
          <input matInput formControlName="reasonCode" />
        </mat-form-field>

        @if (showTransferFields()) {
          <mat-form-field appearance="outline">
            <mat-label>Owner origen</mat-label>
            <input matInput formControlName="fromOwnerGanaderoId" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Owner destino</mat-label>
            <input matInput formControlName="toOwnerGanaderoId" />
          </mat-form-field>
        }
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Cancelar</button>
      <button mat-flat-button color="primary" type="button" [disabled]="form.invalid" (click)="submit()">Registrar evento</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dialog-form {
        display: grid;
        gap: 1rem;
        min-width: min(32rem, 85vw);
        padding-top: 0.5rem;
      }
    `,
  ],
})
class AnimalOperativeEventDialogComponent {
  readonly data = inject<OperativeEventDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<AnimalOperativeEventDialogComponent, OperativeEventDialogResult | undefined>);
  private readonly formBuilder = inject(FormBuilder);

  readonly eventTypeOptions = [
    { value: 'OBSERVATION', label: 'Observación' },
    { value: 'TRANSFERRED', label: 'Transferido' },
    { value: 'SOLD', label: 'Vendido' },
    { value: 'DECEASED', label: 'Fallecido' },
    { value: 'LOST', label: 'Perdido' },
    { value: 'CASTRATION', label: 'Castración' },
  ] as const;
  readonly typeLocked = computed(() => this.data.lockedType === 'CASTRATION');
  readonly title = computed(() => (this.data.lockedType === 'CASTRATION' ? 'Registrar castración' : 'Registrar evento operativo'));
  readonly form = this.formBuilder.group(
    {
      type: [this.data.lockedType ?? ('OBSERVATION' as AnimalEventItem['type']), [Validators.required]],
      occurredAt: [currentLocalDateTimeInput(), [Validators.required]],
      notes: [''],
      reasonCode: [''],
      fromOwnerGanaderoId: [this.data.animal.ownerGanaderoId],
      toOwnerGanaderoId: [''],
    },
    { validators: [transferMetadataValidator] },
  );

  showTransferFields() {
    return this.form.controls.type.value === 'TRANSFERRED';
  }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    this.dialogRef.close({
      type: value.type ?? 'OBSERVATION',
      occurredAt: value.occurredAt ?? currentLocalDateTimeInput(),
      notes: normalizeOptionalText(value.notes),
      metadata: {
        reasonCode: normalizeOptionalText(value.reasonCode) ?? undefined,
        fromOwnerGanaderoId: normalizeOptionalText(value.fromOwnerGanaderoId) ?? undefined,
        toOwnerGanaderoId: normalizeOptionalText(value.toOwnerGanaderoId) ?? undefined,
      },
    });
  }
}

interface ReproductionEventDialogData {
  animal: AnimalItem;
}

interface ReproductionEventDialogResult {
  reproductionEventType: AnimalReproductionEventItem['reproductionEventType'];
  occurredAt: string;
  notes?: string | null;
  metadata: Record<string, unknown>;
}

@Component({
  selector: 'app-animal-reproduction-event-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Registrar evento reproductivo</h2>
    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline">
          <mat-label>Tipo reproductivo</mat-label>
          <mat-select formControlName="reproductionEventType">
            @for (option of reproductionEventTypeOptions; track option.value) {
              <mat-option [value]="option.value">{{ option.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Fecha/hora ocurrencia</mat-label>
          <input matInput type="datetime-local" formControlName="occurredAt" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Notas</mat-label>
          <input matInput formControlName="notes" />
        </mat-form-field>

        <mat-form-field appearance="outline">
          <mat-label>Método de servicio</mat-label>
          <input matInput formControlName="serviceMethod" />
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Cancelar</button>
      <button mat-flat-button color="primary" type="button" [disabled]="form.invalid" (click)="submit()">Registrar evento reproductivo</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .dialog-form {
        display: grid;
        gap: 1rem;
        min-width: min(32rem, 85vw);
        padding-top: 0.5rem;
      }
    `,
  ],
})
class AnimalReproductionEventDialogComponent {
  readonly data = inject<ReproductionEventDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<AnimalReproductionEventDialogComponent, ReproductionEventDialogResult | undefined>);
  private readonly formBuilder = inject(FormBuilder);

  readonly reproductionEventTypeOptions = [
    { value: 'SERVICE', label: 'Servicio' },
    { value: 'PREGNANCY_CONFIRMED', label: 'Preñez confirmada' },
    { value: 'PREGNANCY_LOSS', label: 'Pérdida de preñez' },
    { value: 'BIRTH', label: 'Parto' },
  ] as const;
  readonly form = this.formBuilder.group({
    reproductionEventType: ['SERVICE' as AnimalReproductionEventItem['reproductionEventType'], [Validators.required]],
    occurredAt: [currentLocalDateTimeInput(), [Validators.required]],
    notes: [''],
    serviceMethod: ['Monta controlada'],
  });

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    const value = this.form.getRawValue();
    const reproductionEventType = value.reproductionEventType ?? 'SERVICE';
    this.dialogRef.close({
      reproductionEventType,
      occurredAt: value.occurredAt ?? currentLocalDateTimeInput(),
      notes: normalizeOptionalText(value.notes),
      metadata: reproductionEventType === 'BIRTH'
        ? buildBirthMetadata({
            birthDate: currentLocalDateTimeInput(),
            motherAnimalUuid: this.data.animal.uuid,
            offspringCount: 1,
            offspringAnimalUuids: [],
          })
        : { serviceMethod: normalizeOptionalText(value.serviceMethod) ?? 'Monta controlada' },
    });
  }
}

interface AnimalImagesDialogData {
  animal: AnimalItem;
  images: AnimalImageItem[];
}

@Component({
  selector: 'app-animal-images-dialog',
  standalone: true,
  imports: [CommonModule, MatDialogModule, MatButtonModule],
  template: `
    <h2 mat-dialog-title>Imágenes del animal</h2>
    <mat-dialog-content class="images-dialog">
      @if (!data.images.length) {
        <p>Sin imágenes cargadas.</p>
      } @else {
        <div class="image-grid">
          @for (image of data.images; track image.id) {
            <article class="image-card">
              @if (image.previewUrl) {
                <img [src]="image.previewUrl" [alt]="image.fileName" />
              }
              <p>{{ image.fileName }}</p>
            </article>
          }
        </div>
      }

      <label class="image-picker">
        <span>Seleccionar imágenes</span>
        <input type="file" accept="image/jpeg,image/png" multiple (change)="onFilesSelected($event)" />
      </label>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button type="button" (click)="dialogRef.close()">Cerrar</button>
      <button mat-flat-button color="primary" type="button" [disabled]="!selectedFiles().length" (click)="submit()">Guardar imágenes</button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .images-dialog {
        display: grid;
        gap: 1rem;
        min-width: min(36rem, 85vw);
      }

      .image-grid {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
      }

      .image-card img {
        width: 100%;
        aspect-ratio: 4 / 3;
        object-fit: cover;
      }

      .image-picker {
        display: grid;
        gap: 0.5rem;
      }
    `,
  ],
})
class AnimalImagesDialogComponent {
  readonly data = inject<AnimalImagesDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<AnimalImagesDialogComponent, File[] | undefined>);
  readonly selectedFiles = signal<File[]>([]);

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    this.selectedFiles.set(input.files ? Array.from(input.files) : []);
  }

  submit() {
    this.dialogRef.close(this.selectedFiles());
  }
}

const transferMetadataValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as { type?: string | null; fromOwnerGanaderoId?: string | null; toOwnerGanaderoId?: string | null };
  if (value.type !== 'TRANSFERRED') {
    return null;
  }

  return normalizeOptionalText(value.fromOwnerGanaderoId) && normalizeOptionalText(value.toOwnerGanaderoId)
    ? null
    : { transferMetadataRequired: true };
};

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function currentLocalDateTimeInput() {
  return new Date().toISOString().slice(0, 16);
}

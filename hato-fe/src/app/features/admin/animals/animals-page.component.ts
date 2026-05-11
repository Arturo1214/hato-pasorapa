import { CommonModule } from '@angular/common';
import { Component, DestroyRef, computed, inject, signal, type TemplateRef, viewChild } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, type AbstractControl, type ValidationErrors, type ValidatorFn } from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { finalize, firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/data-access/auth.service';
import { OfflineStatusService } from '../../../core/offline/offline-status.service';
import {
  DataTableComponent,
  DATA_TABLE_FILTER_TYPE,
  type DataTableAction,
  type DataTableCellContext,
  type DataTableColumn,
  type DataTableRow,
  type DataTableRowActionEvent,
} from '../../../shared/ui/data-table/data-table.component';
import { AnimalsEventsService, type AnimalEventItem } from './data-access/animals-events.service';
import { AnimalsImagesService, type AnimalImageItem } from './data-access/animals-images.service';
import {
  AnimalsReproductionEventsService,
  type AnimalReproductionEventItem,
} from './data-access/animals-reproduction-events.service';
import {
  ANIMAL_CATEGORY,
  ANIMAL_CATEGORY_OPTIONS,
  ANIMAL_SEX,
  ANIMAL_SEX_OPTIONS,
  AnimalsService,
  type AnimalItem,
  type AnimalMutationPayload,
} from './data-access/animals.service';
import {
  ANIMAL_DIALOG_MODE,
  AnimalFormDialogComponent,
  type AnimalDialogResult,
  type AnimalOwnerOption,
} from './animal-form-dialog.component';
import { imageSelectionMessage, selectImageFiles } from './animal-image-selection';
import { GanaderosService } from '../ganaderos/data-access/ganaderos.service';

const ANIMAL_TABLE_ACTION = {
  OPERATIVE_EVENT: 'operative-event',
  REPRODUCTIVE_EVENT: 'reproductive-event',
  CASTRATION: 'castration-event',
  IMAGES: 'images',
  VIEW_DETAIL: 'view-detail',
  VIEW_EDIT: 'view-edit',
} as const;

@Component({
  selector: 'app-animals-page',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, DataTableComponent],
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
        <button mat-flat-button color="primary" class="primary-action-button" type="button" (click)="goCreate()">
          <mat-icon>add</mat-icon>
          <span>Nuevo animal</span>
        </button>
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
          <ng-template #animalPreviewCell let-row>
            @let animal = animalFromRow(row);
            @let image = firstImageFor(animal.uuid);
            <div
              class="animal-thumbnail"
              [class.animal-thumbnail--placeholder]="!image?.previewUrl"
              [attr.aria-label]="image?.previewUrl ? null : 'Sin foto del animal'"
            >
              @if (image?.previewUrl) {
                <img [src]="image?.previewUrl" [alt]="thumbnailAlt(animal)" />
              } @else {
                <mat-icon aria-label="Sin foto del animal">pets</mat-icon>
              }
              @if (image?.syncState) {
                <span class="animal-thumbnail__sync" [class.animal-thumbnail__sync--pending]="image?.syncState === 'PENDING'">
                  {{ image?.syncState === 'PENDING' ? 'Pendiente' : image?.syncState === 'FAILED' ? 'Error' : 'Sync' }}
                </span>
              }
            </div>
          </ng-template>

          <ng-template #animalIdentityCell let-row>
            @let animal = animalFromRow(row);
            <div class="animal-identity">
              <strong class="animal-identity__primary">{{ animal.arete || 'Sin arete' }}</strong>
              <span class="animal-identity__meta">Marca: {{ animal.marca || '—' }} · Tatuaje: {{ animal.tatuaje || '—' }}</span>
              <span class="animal-identity__meta">Color: {{ animal.color || '—' }}</span>
            </div>
          </ng-template>

          <app-data-table
            [columns]="columns()"
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
        display: flex;
        justify-content: flex-end;
        gap: 1rem;
      }

      .primary-action-button {
        border-radius: 999px;
      }

      .primary-action-button mat-icon {
        margin-inline-end: 0.25rem;
      }

      .animal-thumbnail {
        position: relative;
        display: grid;
        place-items: center;
        width: 4rem;
        height: 3rem;
        overflow: hidden;
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: 0.75rem;
        background: color-mix(in srgb, var(--mat-sys-primary-container) 35%, var(--mat-sys-surface));
      }

      .animal-thumbnail img {
        width: 100%;
        height: 100%;
        object-fit: cover;
      }

      .animal-thumbnail--placeholder {
        color: var(--mat-sys-on-surface-variant);
      }

      .animal-thumbnail__sync {
        position: absolute;
        right: 0.25rem;
        bottom: 0.25rem;
        padding: 0.1rem 0.35rem;
        border-radius: 999px;
        background: color-mix(in srgb, var(--mat-sys-primary) 88%, transparent);
        color: var(--mat-sys-on-primary);
        font-size: 0.65rem;
        font-weight: 700;
        line-height: 1.2;
      }

      .animal-thumbnail__sync--pending {
        background: color-mix(in srgb, var(--mat-sys-tertiary) 88%, transparent);
      }

      .animal-identity {
        display: grid;
        gap: 0.2rem;
        min-width: 10rem;
      }

      .animal-identity__primary {
        font-size: 0.95rem;
      }

      .animal-identity__meta {
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.8rem;
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
  private readonly router = inject(Router);
  private readonly offlineStatus = inject(OfflineStatusService);
  private readonly dialog = inject(MatDialog);
  private readonly animalPreviewCell = viewChild.required<TemplateRef<DataTableCellContext>>('animalPreviewCell');
  private readonly animalIdentityCell = viewChild.required<TemplateRef<DataTableCellContext>>('animalIdentityCell');

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
  readonly columns = computed<readonly DataTableColumn[]>(() => [
    { key: 'thumbnail', label: 'Foto', cellTemplate: this.animalPreviewCell() },
    {
      key: 'identity',
      label: 'Animal',
      sortable: true,
      filterType: DATA_TABLE_FILTER_TYPE.TEXT,
      formatter: (_value, row) => formatAnimalIdentity(this.animalFromRow(row)),
      cellTemplate: this.animalIdentityCell(),
    },
    {
      key: 'breedName',
      label: 'Raza',
      sortable: true,
      filterType: DATA_TABLE_FILTER_TYPE.TEXT,
      formatter: (value) => typeof value === 'string' && value ? value : 'Sin raza asignada',
    },
    {
      key: 'category',
      label: 'Categoría',
      sortable: true,
      filterType: DATA_TABLE_FILTER_TYPE.SELECT,
      filterOptions: [...ANIMAL_CATEGORY_OPTIONS],
      formatter: (value) => animalCategoryLabel(value),
    },
    {
      key: 'sex',
      label: 'Sexo',
      sortable: true,
      filterType: DATA_TABLE_FILTER_TYPE.SELECT,
      filterOptions: [...ANIMAL_SEX_OPTIONS],
      formatter: (value) => animalSexLabel(value),
    },
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
    {
      key: 'weightKg',
      label: 'Peso / edad',
      sortable: true,
      formatter: (_value, row) => formatWeightAndAge(this.animalFromRow(row)),
    },
    { key: 'admissionDate', label: 'Ingreso', sortable: true, filterType: DATA_TABLE_FILTER_TYPE.DATE },
  ]);
  readonly actions: DataTableAction[] = [
    { id: ANIMAL_TABLE_ACTION.OPERATIVE_EVENT, label: 'Evento operativo', icon: 'event' },
    { id: ANIMAL_TABLE_ACTION.REPRODUCTIVE_EVENT, label: 'Evento reproductivo', icon: 'child_friendly', visible: (row) => isReproductionEligibleAnimal(this.animalFromRow(row)) },
    { id: ANIMAL_TABLE_ACTION.CASTRATION, label: 'Castración', icon: 'content_cut', visible: (row) => isCastrationEligibleAnimal(this.animalFromRow(row)) },
    { id: ANIMAL_TABLE_ACTION.IMAGES, label: 'Imágenes', icon: 'photo_library' },
    { id: ANIMAL_TABLE_ACTION.VIEW_DETAIL, label: 'Ver ficha', icon: 'visibility' },
    { id: ANIMAL_TABLE_ACTION.VIEW_EDIT, label: 'Editar ficha', icon: 'edit' },
  ];

  constructor() {
    this.loadAnimals();
    this.loadOwnerOptionsIfNeeded();
  }

  goCreate() {
    if (!this.canOpenAnimalDialog()) {
      return;
    }

    void this.router.navigateByUrl(`${this.animalsRouteBase()}/nuevo`);
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
        if (!isReproductionEligibleAnimal(animal)) {
          return;
        }
        this.openReproductionEventDialog(animal);
        return;
      case ANIMAL_TABLE_ACTION.CASTRATION:
        if (!isCastrationEligibleAnimal(animal)) {
          return;
        }
        this.openOperativeEventDialog(animal, 'CASTRATION');
        return;
      case ANIMAL_TABLE_ACTION.IMAGES:
        this.openImagesDialog(animal);
        return;
      case ANIMAL_TABLE_ACTION.VIEW_DETAIL:
        void this.router.navigateByUrl(`${this.animalsRouteBase()}/${animal.uuid}`);
        return;
      case ANIMAL_TABLE_ACTION.VIEW_EDIT:
        void this.router.navigateByUrl(`${this.animalsRouteBase()}/${animal.uuid}/editar`);
        return;
      default:
        return;
    }
  }

  animalFromRow(row: DataTableRow): AnimalItem {
    return row as AnimalItem;
  }

  firstImageFor(animalUuid: string): AnimalImageItem | undefined {
    return this.imageTimelines()[animalUuid]?.[0];
  }

  thumbnailAlt(animal: AnimalItem): string {
    return `Foto de ${animal.arete || animal.marca || animal.tatuaje || 'animal sin identificador'}`;
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

  private animalsRouteBase() {
    return this.authService.currentUser()?.role === 'GANADERO' ? '/ganadero/animales' : '/admin/animales';
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
            @for (option of eventTypeOptions(); track option.value) {
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

  readonly eventTypeOptions = computed(() => [
    { value: 'OBSERVATION', label: 'Observación' },
    { value: 'TRANSFERRED', label: 'Transferido' },
    { value: 'SOLD', label: 'Vendido' },
    { value: 'DECEASED', label: 'Fallecido' },
    { value: 'LOST', label: 'Perdido' },
    ...(isCastrationEligibleAnimal(this.data.animal) ? [{ value: 'CASTRATION', label: 'Castración' } as const] : []),
  ] as const);
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
      metadata: { serviceMethod: normalizeOptionalText(value.serviceMethod) ?? 'Monta controlada' },
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
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
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

      <div class="image-picker">
        <input
          #imageInput
          class="native-file-input"
          type="file"
          accept="image/*"
          multiple
          aria-label="Seleccionar imágenes del animal"
          (change)="onFilesSelected($event)"
        />
        <button mat-stroked-button type="button" (click)="openImagePicker(imageInput)">
          <mat-icon>add_photo_alternate</mat-icon>Seleccionar imágenes
        </button>
      </div>

      @if (selectionMessage()) {
        <p class="image-upload-message" role="status">{{ selectionMessage() }}</p>
      }

      @if (selectedImagePreviews().length) {
        <div class="selected-image-preview-list" aria-label="Vista previa de imágenes seleccionadas">
          @for (preview of selectedImagePreviews(); track preview.url) {
            <article class="selected-image-preview">
              <img [src]="preview.url" [alt]="preview.fileName" />
              <span>{{ preview.fileName }}</span>
            </article>
          }
        </div>
      }
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

      .image-picker button {
        justify-self: start;
      }

      .native-file-input {
        position: absolute;
        inline-size: 1px;
        block-size: 1px;
        opacity: 0;
        pointer-events: none;
      }

      .image-upload-message {
        margin: 0;
        color: var(--mat-sys-on-surface-variant);
        font-weight: 500;
      }

      .selected-image-preview-list {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(7rem, 1fr));
        gap: 0.75rem;
      }

      .selected-image-preview {
        display: grid;
        gap: 0.35rem;
      }

      .selected-image-preview img {
        width: 100%;
        aspect-ratio: 4 / 3;
        object-fit: cover;
        border-radius: 0.75rem;
      }

      .selected-image-preview span {
        overflow: hidden;
        color: var(--mat-sys-on-surface-variant);
        font-size: 0.875rem;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    `,
  ],
})
class AnimalImagesDialogComponent {
  readonly data = inject<AnimalImagesDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<AnimalImagesDialogComponent, File[] | undefined>);
  private readonly destroyRef = inject(DestroyRef);
  readonly selectedFiles = signal<File[]>([]);
  readonly selectedImagePreviews = signal<SelectedImagePreview[]>([]);
  readonly selectionMessage = signal<string | null>(null);

  constructor() {
    this.destroyRef.onDestroy(() => this.clearSelectedImageSelection());
  }

  openImagePicker(input: HTMLInputElement) { input.click(); }

  onFilesSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = input.files ? Array.from(input.files) : [];
    this.clearSelectedImageSelection();

    if (!files.length) {
      input.value = '';
      return;
    }

    const selection = selectImageFiles(files);
    const message = imageSelectionMessage(selection);

    if (!selection.acceptedFiles.length) {
      input.value = '';
      this.selectionMessage.set(message);
      return;
    }

    this.selectedFiles.set(selection.acceptedFiles);
    this.selectedImagePreviews.set(selection.acceptedFiles.map((file) => ({ fileName: file.name, url: URL.createObjectURL(file) })));
    this.selectionMessage.set(message);
  }

  submit() {
    this.dialogRef.close(this.selectedFiles());
  }

  private clearSelectedImageSelection() {
    for (const preview of this.selectedImagePreviews()) {
      URL.revokeObjectURL(preview.url);
    }
    this.selectedFiles.set([]);
    this.selectedImagePreviews.set([]);
    this.selectionMessage.set(null);
  }
}

interface SelectedImagePreview {
  fileName: string;
  url: string;
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

function formatAnimalIdentity(animal: AnimalItem) {
  return [animal.arete, animal.marca, animal.tatuaje].filter((value): value is string => Boolean(value)).join(' ');
}

function animalCategoryLabel(value: unknown) {
  return ANIMAL_CATEGORY_OPTIONS.find((option) => option.value === value)?.label ?? String(value ?? '—');
}

function animalSexLabel(value: unknown) {
  return ANIMAL_SEX_OPTIONS.find((option) => option.value === value)?.label ?? String(value ?? '—');
}

function isCastrationEligibleAnimal(animal: AnimalItem) {
  return animal.sex === ANIMAL_SEX.MACHO
    && (animal.category === ANIMAL_CATEGORY.TORO || animal.category === ANIMAL_CATEGORY.TERNERO);
}

function isReproductionEligibleAnimal(animal: AnimalItem) {
  return animal.sex === ANIMAL_SEX.HEMBRA
    && (animal.category === ANIMAL_CATEGORY.VACA || animal.category === ANIMAL_CATEGORY.VAQUILLONA);
}

function formatWeightAndAge(animal: AnimalItem) {
  const weight = animal.weightKg === null ? 'Sin peso' : `${animal.weightKg} kg`;
  const age = animal.birthDate ? formatAge(animal.birthDate) : 'Sin fecha nac.';
  return `${weight} · ${age}`;
}

function formatAge(birthDate: string) {
  const birth = new Date(`${birthDate}T00:00:00`);
  if (Number.isNaN(birth.getTime())) {
    return 'Edad no disponible';
  }

  const today = new Date();
  const totalMonths = Math.max(
    0,
    (today.getFullYear() - birth.getFullYear()) * 12 + today.getMonth() - birth.getMonth() - (today.getDate() < birth.getDate() ? 1 : 0),
  );

  if (totalMonths < 12) {
    return `${totalMonths} mes${totalMonths === 1 ? '' : 'es'}`;
  }

  const years = Math.floor(totalMonths / 12);
  return `${years} año${years === 1 ? '' : 's'}`;
}

function currentLocalDateTimeInput() {
  return new Date().toISOString().slice(0, 16);
}

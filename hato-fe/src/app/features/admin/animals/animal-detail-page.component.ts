import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MAT_DIALOG_DATA, MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTabsModule } from '@angular/material/tabs';
import { ActivatedRoute, Router } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from '../../../core/auth/data-access/auth.service';
import { OfflineStatusService } from '../../../core/offline/offline-status.service';
import { AnimalsEventsService, type AnimalEventItem } from './data-access/animals-events.service';
import { AnimalsHealthEventsService, type AnimalHealthEventItem } from './data-access/animals-health-events.service';
import { AnimalsImagesService, type AnimalImageItem } from './data-access/animals-images.service';
import {
  AnimalsReproductionEventsService,
  PREGNANCY_DIAGNOSIS_RESULT,
  REPRODUCTIVE_SERVICE_METHOD,
  buildPregnancyDiagnosisMetadata,
  buildServiceMetadata,
  type AnimalReproductionEventItem,
  type PregnancyDiagnosisResult,
  type ReproductiveServiceMethod,
} from './data-access/animals-reproduction-events.service';
import { ANIMAL_CATEGORY, ANIMAL_CATEGORY_OPTIONS, ANIMAL_SEX, AnimalsService, type AnimalCategory, type AnimalGenealogy, type AnimalItem } from './data-access/animals.service';

@Component({
  selector: 'app-animal-detail-page',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule, MatIconModule, MatTabsModule],
  template: `
    <section class="animal-detail-page">
      <div class="detail-actions">
        <button mat-stroked-button type="button" (click)="goBack()">
          <mat-icon>arrow_back</mat-icon>
          Volver a animales
        </button>
        <button mat-flat-button color="primary" type="button" (click)="goEdit()">
          <mat-icon>edit</mat-icon>
          Editar
        </button>
        @if (canRegisterBirth()) {
          <button mat-flat-button color="primary" type="button" (click)="openServiceRegistration()">
            <mat-icon>favorite</mat-icon>
            Registrar servicio
          </button>
          <button mat-flat-button color="primary" type="button" (click)="openPregnancyDiagnosisRegistration()">
            <mat-icon>fact_check</mat-icon>
            Registrar diagnóstico de preñez
          </button>
          <button mat-flat-button color="accent" type="button" (click)="openBirthRegistration()">
            <mat-icon>child_friendly</mat-icon>
            Registrar nacimiento
          </button>
        }
      </div>

      @if (loading()) {
        <mat-card appearance="outlined" role="status"><p>Cargando ficha animal…</p></mat-card>
      } @else if (errorMessage()) {
        <mat-card appearance="outlined" role="alert"><p>{{ errorMessage() }}</p></mat-card>
      } @else if (animal()) {
        <mat-tab-group>
          <mat-tab label="Ficha">
            <mat-card appearance="outlined" class="detail-card">
              <dl class="ficha-grid">
                <div><dt>Arete</dt><dd>{{ animal()?.arete || '—' }}</dd></div>
                <div><dt>Marca</dt><dd>{{ animal()?.marca || '—' }}</dd></div>
                <div><dt>Tatuaje</dt><dd>{{ animal()?.tatuaje || '—' }}</dd></div>
                <div><dt>Raza</dt><dd>{{ animal()?.breedName || 'Sin raza asignada' }}</dd></div>
                <div><dt>Color</dt><dd>{{ animal()?.color || '—' }}</dd></div>
                <div class="ficha-grid__wide"><dt>Descripción</dt><dd>{{ animal()?.description || '—' }}</dd></div>
                <div><dt>Categoría</dt><dd>{{ categoryLabel(animal()?.category) }}</dd></div>
                <div><dt>Sexo</dt><dd>{{ sexLabel(animal()?.sex) }}</dd></div>
                <div><dt>Estado</dt><dd>{{ animal()?.active ? 'Activo' : 'Inactivo' }}</dd></div>
                <div><dt>Peso</dt><dd>{{ weightLabel(animal()?.weightKg) }}</dd></div>
                <div><dt>Nacimiento / edad</dt><dd>{{ birthAndAgeLabel(animal()) }}</dd></div>
                <div><dt>Ingreso</dt><dd>{{ animal()?.admissionDate || '—' }}</dd></div>
              </dl>
            </mat-card>
          </mat-tab>

          <mat-tab label="Imágenes">
            <mat-card appearance="outlined" class="detail-card gallery">
              @if (images().length) {
                @let mainImage = images()[0];
                <img class="main-image" [src]="mainImage.previewUrl" [alt]="imageAlt(animal())" />
                <div class="thumbnail-strip" aria-label="Miniaturas del animal">
                  @for (image of images(); track image.id) {
                    <img [src]="image.previewUrl" [alt]="image.fileName" />
                  }
                </div>
              } @else {
                <p>Sin imágenes registradas para este animal.</p>
              }
            </mat-card>
          </mat-tab>

          <mat-tab label="Salud">
            <mat-card appearance="outlined" class="detail-card">
              @if (healthEvents().length) {
                <ul class="event-list">
                  @for (event of healthEvents(); track event.id) {
                    <li>{{ event.occurredAt }} · {{ healthEventLabel(event.healthEventType) }} @if (event.notes) { — {{ event.notes }} }</li>
                  }
                </ul>
              } @else {
                <p>Sin eventos sanitarios registrados.</p>
              }
            </mat-card>
          </mat-tab>

          <mat-tab label="Reproducción">
            <mat-card appearance="outlined" class="detail-card">
              @if (activeGestation(); as gestation) {
                <section class="active-gestation" aria-label="Gestación activa">
                  <h3>Gestación activa</h3>
                  <dl>
                    <div><dt>Fecha probable de parto</dt><dd>{{ gestation.expectedBirthDate }}</dd></div>
                    <div><dt>Estado</dt><dd>{{ gestation.statusLabel }}</dd></div>
                    @if (gestation.serviceLabel) {
                      <div><dt>Servicio asociado</dt><dd>{{ gestation.serviceLabel }}</dd></div>
                    }
                  </dl>
                </section>
              }
              @if (reproductionEvents().length) {
                <ul class="event-list">
                  @for (event of reproductionEvents(); track event.id) {
                    <li>
                      {{ event.occurredAt }} · {{ reproductionEventLabel(event.reproductionEventType) }} @if (event.notes) { — {{ event.notes }} }
                      @if (pregnancyExpectedBirthDateLabel(event); as expectedBirthDate) {
                        <span class="event-metadata">Fecha probable de parto: {{ expectedBirthDate }}</span>
                      }
                    </li>
                  }
                </ul>
              } @else {
                <p>Sin eventos reproductivos registrados.</p>
              }
            </mat-card>
          </mat-tab>

          <mat-tab label="Historial">
            <mat-card appearance="outlined" class="detail-card">
              @if (events().length) {
                <ul class="event-list">
                  @for (event of events(); track event.id) {
                    <li>{{ event.occurredAt }} · {{ animalEventLabel(event.type) }} @if (event.notes) { — {{ event.notes }} }</li>
                  }
                </ul>
              } @else {
                <p>Sin eventos operativos registrados.</p>
              }
            </mat-card>
          </mat-tab>

          <mat-tab label="Genealogía">
            <mat-card appearance="outlined" class="detail-card genealogy">
              @let currentAnimal = genealogy()?.animal ?? animal();
              <section class="genealogy-tree" aria-label="Árbol genealógico del animal">
                <div class="genealogy-generation">
                  <h3>Ascendencia</h3>
                  @if (hasGrandparents(genealogy())) {
                    <h4>Abuelos</h4>
                    <div class="genealogy-grandparents" aria-label="Abuelos registrados">
                      @if (genealogy()?.ancestors?.mother?.mother?.animal; as maternalGrandmother) {
                        <article class="genealogy-node genealogy-node--grandparent">
                          <span class="genealogy-node__label">Abuela materna</span>
                          <strong>{{ animalName(maternalGrandmother) }}</strong>
                        </article>
                      }
                      @if (genealogy()?.ancestors?.mother?.father?.animal; as maternalGrandfather) {
                        <article class="genealogy-node genealogy-node--grandparent">
                          <span class="genealogy-node__label">Abuelo materno</span>
                          <strong>{{ animalName(maternalGrandfather) }}</strong>
                        </article>
                      }
                      @if (genealogy()?.ancestors?.father?.mother?.animal; as paternalGrandmother) {
                        <article class="genealogy-node genealogy-node--grandparent">
                          <span class="genealogy-node__label">Abuela paterna</span>
                          <strong>{{ animalName(paternalGrandmother) }}</strong>
                        </article>
                      }
                      @if (genealogy()?.ancestors?.father?.father?.animal; as paternalGrandfather) {
                        <article class="genealogy-node genealogy-node--grandparent">
                          <span class="genealogy-node__label">Abuelo paterno</span>
                          <strong>{{ animalName(paternalGrandfather) }}</strong>
                        </article>
                      }
                    </div>
                  } @else {
                    <p class="genealogy-empty">Sin abuelos registrados.</p>
                  }
                  <div class="genealogy-parents" aria-label="Madre y padre registrados">
                    <article class="genealogy-node genealogy-node--parent">
                      <span class="genealogy-node__label">Madre</span>
                      <strong>{{ genealogy()?.mother ? animalName(genealogy()?.mother) : 'Animal fundador: sin madre/padre registrados' }}</strong>
                    </article>
                    <article class="genealogy-node genealogy-node--parent">
                      <span class="genealogy-node__label">Padre</span>
                      <strong>{{ genealogy()?.father ? animalName(genealogy()?.father) : 'Sin padre registrado' }}</strong>
                    </article>
                  </div>
                </div>

                <div class="genealogy-connector" aria-hidden="true"></div>

                <article class="genealogy-node genealogy-node--current" aria-current="true">
                  <span class="genealogy-node__label">Animal actual</span>
                  <strong>{{ animalName(currentAnimal) }}</strong>
                  <span>{{ categoryLabel(currentAnimal?.category) }} · {{ sexLabel(currentAnimal?.sex) }}</span>
                </article>

                <div class="genealogy-connector" aria-hidden="true"></div>

                <div class="genealogy-generation">
                  <h3>Descendencia</h3>
                  @if (genealogy()?.offspring?.length) {
                    <div class="genealogy-offspring" aria-label="Crías registradas">
                      @for (offspring of genealogy()?.offspring; track offspring.uuid) {
                        <article class="genealogy-node genealogy-node--offspring">
                          <span class="genealogy-node__label">Cría</span>
                          <strong>{{ animalName(offspring) }}</strong>
                          <span>{{ categoryLabel(offspring.category) }} · {{ sexLabel(offspring.sex) }}</span>
                        </article>
                      }
                    </div>
                  } @else {
                    <p class="genealogy-empty">Sin crías registradas.</p>
                  }
                </div>
              </section>
            </mat-card>
          </mat-tab>
        </mat-tab-group>
      }
    </section>
  `,
  styles: [`
    .animal-detail-page { display: grid; gap: 1rem; padding: 1rem; }
    .detail-actions { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .detail-actions mat-icon { margin-inline-end: .25rem; }
    .detail-card { margin-top: 1rem; padding: 1rem; }
    .ficha-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: 1rem; margin: 0; }
    .ficha-grid__wide { grid-column: 1 / -1; }
    dt { color: var(--mat-sys-on-surface-variant); font-size: .8rem; }
    dd { margin: .25rem 0 0; font-weight: 600; }
    .main-image { width: min(36rem, 100%); max-height: 24rem; object-fit: cover; border-radius: 1rem; }
    .thumbnail-strip { display: flex; gap: .75rem; margin-top: .75rem; overflow-x: auto; }
    .thumbnail-strip img { width: 5rem; height: 4rem; object-fit: cover; border-radius: .75rem; }
    .event-list { margin: 0; padding-left: 1.25rem; }
    .event-metadata { display: block; margin-top: .25rem; color: var(--mat-sys-on-surface-variant); font-size: .9rem; }
    .active-gestation { margin-bottom: 1rem; padding: 1rem; border: 1px solid var(--mat-sys-primary); border-radius: 1rem; background: var(--mat-sys-primary-container); color: var(--mat-sys-on-primary-container); }
    .active-gestation h3 { margin: 0 0 .75rem; }
    .active-gestation dl { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: .75rem; margin: 0; }
    .active-gestation dt { color: inherit; opacity: .78; }
    .genealogy-tree { display: grid; justify-items: center; gap: .75rem; text-align: center; }
    .genealogy-generation { width: 100%; display: grid; gap: .75rem; }
    .genealogy-generation h3 { margin: 0; font-size: .95rem; color: var(--mat-sys-on-surface-variant); font-weight: 600; }
    .genealogy-generation h4 { margin: 0; font-size: .85rem; color: var(--mat-sys-on-surface-variant); font-weight: 600; }
    .genealogy-grandparents, .genealogy-parents, .genealogy-offspring { display: grid; grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr)); gap: .75rem; width: 100%; }
    .genealogy-node { display: grid; gap: .25rem; padding: .85rem; border: 1px solid var(--mat-sys-outline-variant); border-radius: 1rem; background: var(--mat-sys-surface-container-low); min-height: 5rem; align-content: center; }
    .genealogy-node--current { min-width: min(18rem, 100%); border-color: var(--mat-sys-primary); background: var(--mat-sys-primary-container); color: var(--mat-sys-on-primary-container); box-shadow: 0 .5rem 1.5rem color-mix(in srgb, var(--mat-sys-primary) 18%, transparent); }
    .genealogy-node__label { font-size: .75rem; text-transform: uppercase; letter-spacing: .06em; color: var(--mat-sys-on-surface-variant); }
    .genealogy-node--current .genealogy-node__label { color: var(--mat-sys-on-primary-container); }
    .genealogy-connector { width: 2px; height: 1.5rem; background: var(--mat-sys-outline-variant); }
    .genealogy-empty { margin: 0; color: var(--mat-sys-on-surface-variant); }
  `],
})
export class AnimalDetailPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly dialog = inject(MatDialog);
  private readonly animalsService = inject(AnimalsService);
  private readonly imagesService = inject(AnimalsImagesService);
  private readonly eventsService = inject(AnimalsEventsService);
  private readonly healthEventsService = inject(AnimalsHealthEventsService);
  private readonly reproductionEventsService = inject(AnimalsReproductionEventsService);
  private readonly uuid = this.route.snapshot.paramMap.get('uuid') ?? '';

  readonly animal = signal<AnimalItem | null>(null);
  readonly images = signal<AnimalImageItem[]>([]);
  readonly events = signal<AnimalEventItem[]>([]);
  readonly healthEvents = signal<AnimalHealthEventItem[]>([]);
  readonly reproductionEvents = signal<AnimalReproductionEventItem[]>([]);
  readonly genealogy = signal<AnimalGenealogy | null>(null);
  readonly loading = signal(true);
  readonly errorMessage = signal<string | null>(null);
  readonly listRoute = computed(() => this.authService.currentUser()?.role === 'GANADERO' ? '/ganadero/animales' : '/admin/animales');
  readonly canRegisterBirth = computed(() => this.animal()?.sex === ANIMAL_SEX.HEMBRA);
  readonly serviceEventOptions = computed(() => this.reproductionEvents()
    .filter((event) => event.reproductionEventType === 'SERVICE')
    .slice(0, 10)
    .map((event) => ({ uuid: event.id, label: serviceEventOptionLabel(event) })));
  readonly activeGestation = computed(() => buildActiveGestationSummary(this.reproductionEvents()));

  constructor() {
    this.loadDetail();
  }

  goBack() { void this.router.navigateByUrl(this.listRoute()); }

  goEdit() { void this.router.navigateByUrl(`${this.listRoute()}/${this.uuid}/editar`); }

  openBirthRegistration() {
    const mother = this.animal();
    if (!mother) return;

    this.dialog.open(AnimalBirthRegistrationDialogComponent, {
      width: 'min(44rem, 96vw)',
      data: {
        motherUuid: mother.uuid,
        ownerGanaderoId: mother.ownerGanaderoId,
      } satisfies AnimalBirthRegistrationDialogData,
    }).afterClosed().subscribe((registered) => {
      if (registered) {
        this.loadDetail();
      }
    });
  }

  openServiceRegistration() {
    const female = this.animal();
    if (!female) return;

    this.dialog.open(AnimalServiceRegistrationDialogComponent, {
      width: 'min(42rem, 96vw)',
      data: {
        animalUuid: female.uuid,
        ownerGanaderoId: female.ownerGanaderoId,
      } satisfies AnimalServiceRegistrationDialogData,
    }).afterClosed().subscribe((registered) => {
      if (registered) {
        this.loadDetail();
      }
    });
  }

  openPregnancyDiagnosisRegistration() {
    const female = this.animal();
    if (!female) return;

    this.dialog.open(AnimalPregnancyDiagnosisDialogComponent, {
      width: 'min(42rem, 96vw)',
      data: {
        animalUuid: female.uuid,
        serviceOptions: this.serviceEventOptions(),
      } satisfies AnimalPregnancyDiagnosisDialogData,
    }).afterClosed().subscribe((registered) => {
      if (registered) {
        this.loadDetail();
      }
    });
  }

  imageAlt(animal: AnimalItem | null) { return `Foto de ${animalName(animal)}`; }

  animalName(animal: AnimalItem | null | undefined) { return animalName(animal); }

  hasGrandparents(genealogy: AnimalGenealogy | null) {
    return Boolean(
      genealogy?.ancestors?.mother?.mother?.animal
      || genealogy?.ancestors?.mother?.father?.animal
      || genealogy?.ancestors?.father?.mother?.animal
      || genealogy?.ancestors?.father?.father?.animal
    );
  }

  categoryLabel(category: AnimalItem['category'] | undefined) {
    return ({ TERNERO: 'Ternero', TERNERA: 'Ternera', VAQUILLONA: 'Vaquillona', VACA: 'Vaca', TORO: 'Toro', BUEY: 'Buey' } as const)[category ?? 'VACA'] ?? '—';
  }

  sexLabel(sex: AnimalItem['sex'] | undefined | null) { return sex === 'MACHO' ? 'Macho' : sex === 'HEMBRA' ? 'Hembra' : '—'; }

  weightLabel(weightKg: number | null | undefined) { return weightKg == null ? '—' : `${weightKg} kg`; }

  birthAndAgeLabel(animal: AnimalItem | null) {
    if (!animal?.birthDate) return '—';
    const years = new Date().getFullYear() - new Date(animal.birthDate).getFullYear();
    return `${animal.birthDate} · ${years} año(s)`;
  }

  animalEventLabel(type: AnimalEventItem['type']) { return type === 'OBSERVATION' ? 'Observación' : type; }

  healthEventLabel(type: AnimalHealthEventItem['healthEventType']) { return type.replaceAll('_', ' '); }

  reproductionEventLabel(type: AnimalReproductionEventItem['reproductionEventType']) {
    return ({
      SERVICE: 'Servicio reproductivo',
      PREGNANCY_DIAGNOSIS: 'Diagnóstico de preñez',
      PREGNANCY_CONFIRMED: 'Preñez confirmada',
      PREGNANCY_LOSS: 'Pérdida de preñez',
      BIRTH: 'Nacimiento',
    } as const)[type] ?? type.replaceAll('_', ' ');
  }

  pregnancyExpectedBirthDateLabel(event: AnimalReproductionEventItem) {
    if (event.reproductionEventType !== 'PREGNANCY_DIAGNOSIS') {
      return null;
    }
    return firstText(event.metadata.expectedBirthDate)?.slice(0, 10) ?? null;
  }

  private loadDetail() {
    forkJoin({
      animal: this.animalsService.getAnimal(this.uuid),
      images: this.imagesService.listImages(this.uuid).pipe(catchError(() => of([] as AnimalImageItem[]))),
      events: this.eventsService.listEvents(this.uuid).pipe(catchError(() => of([] as AnimalEventItem[]))),
      healthEvents: this.healthEventsService.listEvents(this.uuid).pipe(catchError(() => of([] as AnimalHealthEventItem[]))),
      reproductionEvents: this.reproductionEventsService.listEvents(this.uuid).pipe(catchError(() => of([] as AnimalReproductionEventItem[]))),
      genealogy: this.animalsService.getGenealogy(this.uuid, 2).pipe(catchError(() => of(null))),
    }).subscribe({
      next: (detail) => {
        this.animal.set(detail.animal);
        this.images.set(detail.images.filter((image) => Boolean(image.previewUrl)));
        this.events.set(detail.events);
        this.healthEvents.set(detail.healthEvents);
        this.reproductionEvents.set(detail.reproductionEvents);
        this.genealogy.set(detail.genealogy);
        this.loading.set(false);
      },
      error: () => {
        this.errorMessage.set('No pudimos cargar la ficha animal. Verificá permisos o conexión.');
        this.loading.set(false);
      },
    });
  }
}

interface AnimalBirthRegistrationDialogData {
  motherUuid: string;
  ownerGanaderoId: string;
}

interface AnimalServiceRegistrationDialogData {
  animalUuid: string;
  ownerGanaderoId: string;
}

interface AnimalPregnancyDiagnosisDialogData {
  animalUuid: string;
  serviceOptions: AnimalServiceEventOption[];
}

interface AnimalServiceEventOption {
  uuid: string;
  label: string;
}

interface ActiveGestationSummary {
  expectedBirthDate: string;
  statusLabel: string;
  serviceLabel: string | null;
}

type CalfFormGroup = FormGroup<{
  arete: FormControl<string>;
  marca: FormControl<string>;
  tatuaje: FormControl<string>;
  category: FormControl<AnimalCategory>;
  weightKg: FormControl<number | null>;
}>;

@Component({
  selector: 'app-animal-pregnancy-diagnosis-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>Registrar diagnóstico de preñez</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content class="diagnosis-form">
      <mat-form-field appearance="outline">
        <mat-label>Fecha del diagnóstico</mat-label>
        <input matInput type="date" formControlName="diagnosisDate" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Resultado</mat-label>
        <mat-select formControlName="result">
          <mat-option [value]="results.PRENADA">Preñada</mat-option>
          <mat-option [value]="results.NO_PRENADA">No preñada</mat-option>
        </mat-select>
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Servicio reproductivo asociado</mat-label>
        <mat-select formControlName="serviceEventUuid">
          <mat-option [value]="null">Sin servicio asociado</mat-option>
          @for (service of data.serviceOptions; track service.uuid) {
            <mat-option [value]="service.uuid">{{ service.label }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      @if (form.controls.result.value === results.PRENADA) {
        <mat-form-field appearance="outline">
          <mat-label>Fecha probable de parto</mat-label>
          <input matInput type="date" formControlName="expectedBirthDate" />
        </mat-form-field>
      }

      <mat-form-field appearance="outline">
        <mat-label>Notas</mat-label>
        <textarea matInput formControlName="notes"></textarea>
      </mat-form-field>

      @if (errorMessage()) {
        <p role="alert">{{ errorMessage() }}</p>
      }
    </form>
    <div mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false">Cancelar</button>
      <button mat-flat-button color="primary" type="button" (click)="submit()" [disabled]="form.invalid || saving()">Registrar diagnóstico</button>
    </div>
  `,
  styles: [`
    .diagnosis-form { display: grid; gap: .75rem; }
    [role="alert"] { color: var(--mat-sys-error); margin: 0; }
  `],
})
export class AnimalPregnancyDiagnosisDialogComponent {
  private readonly fb = inject(FormBuilder);
  readonly data = inject<AnimalPregnancyDiagnosisDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<AnimalPregnancyDiagnosisDialogComponent, boolean>);
  private readonly reproductionEventsService = inject(AnimalsReproductionEventsService);

  readonly results = PREGNANCY_DIAGNOSIS_RESULT;
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    diagnosisDate: [new Date().toISOString().slice(0, 10), Validators.required],
    result: [PREGNANCY_DIAGNOSIS_RESULT.PRENADA as PregnancyDiagnosisResult, Validators.required],
    serviceEventUuid: this.fb.control<string | null>(null),
    expectedBirthDate: [''],
    notes: [''],
  });

  submit() {
    if (this.form.invalid || this.saving()) return;
    const value = this.form.getRawValue();

    this.saving.set(true);
    this.errorMessage.set(null);
    this.reproductionEventsService.createEvent({
      animalUuid: this.data.animalUuid,
      reproductionEventType: 'PREGNANCY_DIAGNOSIS',
      occurredAt: value.diagnosisDate,
      notes: value.notes,
      metadata: buildPregnancyDiagnosisMetadata({
        diagnosisDate: value.diagnosisDate,
        result: value.result,
        serviceEventUuid: value.serviceEventUuid,
        expectedBirthDate: value.expectedBirthDate,
      }),
    }).subscribe({
      next: (feedback) => feedback.outcome === 'queued'
        ? this.dialogRef.close(true)
        : this.showSaveError(),
      error: () => this.showSaveError(),
    });
  }

  private showSaveError() {
    this.errorMessage.set('No pudimos registrar el diagnóstico de preñez. Revisá los datos o intentá de nuevo.');
    this.saving.set(false);
  }
}

@Component({
  selector: 'app-animal-service-registration-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>Registrar servicio reproductivo</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content class="service-form">
      <mat-form-field appearance="outline">
        <mat-label>Fecha del servicio</mat-label>
        <input matInput type="date" formControlName="serviceDate" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Método</mat-label>
        <mat-select formControlName="serviceMethod">
          <mat-option [value]="serviceMethods.MONTA_NATURAL">Monta natural</mat-option>
          <mat-option [value]="serviceMethods.INSEMINACION_ARTIFICIAL">Inseminación artificial</mat-option>
        </mat-select>
      </mat-form-field>

      @if (form.controls.serviceMethod.value === serviceMethods.MONTA_NATURAL) {
        <mat-form-field appearance="outline">
          <mat-label>Toro / padre</mat-label>
          <mat-select formControlName="fatherAnimalUuid">
            @for (sire of sireOptions(); track sire.uuid) {
              <mat-option [value]="sire.uuid">{{ animalName(sire) }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
      } @else {
        <mat-form-field appearance="outline">
          <mat-label>Referencia de semen</mat-label>
          <input matInput formControlName="semenReference" />
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>Referencia de toro</mat-label>
          <input matInput formControlName="bullReference" />
        </mat-form-field>
      }

      <mat-form-field appearance="outline">
        <mat-label>Notas</mat-label>
        <textarea matInput formControlName="notes"></textarea>
      </mat-form-field>

      @if (errorMessage()) {
        <p role="alert">{{ errorMessage() }}</p>
      }
    </form>
    <div mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false">Cancelar</button>
      <button mat-flat-button color="primary" type="button" (click)="submit()" [disabled]="form.invalid || saving()">Registrar servicio</button>
    </div>
  `,
  styles: [`
    .service-form { display: grid; gap: .75rem; }
    [role="alert"] { color: var(--mat-sys-error); margin: 0; }
  `],
})
export class AnimalServiceRegistrationDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly data = inject<AnimalServiceRegistrationDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<AnimalServiceRegistrationDialogComponent, boolean>);
  private readonly animalsService = inject(AnimalsService);
  private readonly reproductionEventsService = inject(AnimalsReproductionEventsService);

  readonly serviceMethods = REPRODUCTIVE_SERVICE_METHOD;
  readonly sireOptions = signal<AnimalItem[]>([]);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly form = this.fb.nonNullable.group({
    serviceDate: [new Date().toISOString().slice(0, 10), Validators.required],
    serviceMethod: [REPRODUCTIVE_SERVICE_METHOD.MONTA_NATURAL as ReproductiveServiceMethod, Validators.required],
    fatherAnimalUuid: this.fb.control<string | null>(null),
    semenReference: [''],
    bullReference: [''],
    notes: [''],
  });

  constructor() {
    this.animalsService.listAnimals({ ownerGanaderoId: this.data.ownerGanaderoId, active: true }).subscribe({
      next: (animals) => this.sireOptions.set(animals.filter((animal) => animal.sex === ANIMAL_SEX.MACHO && animal.uuid !== this.data.animalUuid)),
      error: () => this.sireOptions.set([]),
    });
  }

  animalName(animal: AnimalItem) { return animalName(animal); }

  submit() {
    if (this.form.invalid || this.saving()) return;
    const value = this.form.getRawValue();
    if (value.serviceMethod === REPRODUCTIVE_SERVICE_METHOD.MONTA_NATURAL && !value.fatherAnimalUuid) {
      this.errorMessage.set('Seleccioná el toro/padre para la monta natural.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    this.reproductionEventsService.createEvent({
      animalUuid: this.data.animalUuid,
      reproductionEventType: 'SERVICE',
      occurredAt: value.serviceDate,
      notes: value.notes,
      metadata: buildServiceMetadata({
        serviceMethod: value.serviceMethod,
        fatherAnimalUuid: value.fatherAnimalUuid,
        semenReference: value.semenReference,
        bullReference: value.bullReference,
      }),
    }).subscribe({
      next: (feedback) => feedback.outcome === 'queued'
        ? this.dialogRef.close(true)
        : this.showSaveError(),
      error: () => this.showSaveError(),
    });
  }

  private showSaveError() {
    this.errorMessage.set('No pudimos registrar el servicio. Revisá los datos o intentá de nuevo.');
    this.saving.set(false);
  }
}

@Component({
  selector: 'app-animal-birth-registration-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  template: `
    <h2 mat-dialog-title>Registrar nacimiento</h2>
    <form [formGroup]="form" (ngSubmit)="submit()" mat-dialog-content class="birth-form">
      <mat-form-field appearance="outline">
        <mat-label>Fecha de nacimiento</mat-label>
        <input matInput type="date" formControlName="birthDate" />
      </mat-form-field>

      <mat-form-field appearance="outline">
        <mat-label>Padre / toro (opcional)</mat-label>
        <mat-select formControlName="fatherAnimalUuid">
          <mat-option [value]="null">Sin padre informado</mat-option>
          @for (father of fatherOptions(); track father.uuid) {
            <mat-option [value]="father.uuid">{{ animalName(father) }}</mat-option>
          }
        </mat-select>
      </mat-form-field>

      <p class="birth-online-note">
        El registro de parto requiere conexión para crear el ternero y actualizar la genealogía en una sola operación.
      </p>
      @if (!isOnline()) {
        <p class="birth-offline-note" role="status">Necesitás conexión para registrar el parto.</p>
      }

      <section formArrayName="offspring" class="offspring-list">
        @for (calfForm of offspring.controls; track $index; let index = $index) {
          <article class="offspring-card" [formGroupName]="index">
            <div class="offspring-card__header">
              <h3>Ternero {{ index + 1 }}</h3>
              @if (offspring.length > 1) {
                <button mat-button color="warn" type="button" (click)="removeOffspring(index)">Quitar</button>
              }
            </div>
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
                @for (option of calfCategoryOptions; track option.value) {
                  <mat-option [value]="option.value">{{ option.label }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Peso al nacer (kg)</mat-label>
              <input matInput type="number" min="0" formControlName="weightKg" />
            </mat-form-field>
          </article>
        }
      </section>
      <button mat-stroked-button type="button" (click)="addOffspring()">Agregar ternero</button>

      <mat-form-field appearance="outline">
        <mat-label>Notas</mat-label>
        <textarea matInput formControlName="notes"></textarea>
      </mat-form-field>

      @if (errorMessage()) {
        <p role="alert">{{ errorMessage() }}</p>
      }
    </form>
    <div mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="false">Cancelar</button>
      <button mat-flat-button color="primary" type="button" (click)="submit()" [disabled]="form.invalid || saving() || !isOnline()">Registrar</button>
    </div>
  `,
  styles: [`
    .birth-form { display: grid; gap: .75rem; }
    .birth-online-note, .birth-offline-note { margin: 0; color: var(--mat-sys-on-surface-variant); }
    .birth-offline-note { color: var(--mat-sys-error); }
    .offspring-list { display: grid; gap: .75rem; }
    .offspring-card { display: grid; gap: .75rem; padding: .75rem; border: 1px solid var(--mat-sys-outline-variant); border-radius: .75rem; }
    .offspring-card__header { display: flex; align-items: center; justify-content: space-between; gap: .75rem; }
    h3 { margin: 0; font-size: 1rem; }
    [role="alert"] { color: var(--mat-sys-error); margin: 0; }
  `],
})
export class AnimalBirthRegistrationDialogComponent {
  private readonly fb = inject(FormBuilder);
  private readonly data = inject<AnimalBirthRegistrationDialogData>(MAT_DIALOG_DATA);
  private readonly dialogRef = inject(MatDialogRef<AnimalBirthRegistrationDialogComponent, boolean>);
  private readonly animalsService = inject(AnimalsService);
  private readonly offlineStatus = inject(OfflineStatusService);

  readonly calfCategoryOptions = ANIMAL_CATEGORY_OPTIONS.filter((option) => option.value === ANIMAL_CATEGORY.TERNERO || option.value === ANIMAL_CATEGORY.TERNERA);
  readonly fatherOptions = signal<AnimalItem[]>([]);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isOnline = this.offlineStatus.isOnline;

  readonly form = this.fb.nonNullable.group({
    birthDate: [new Date().toISOString().slice(0, 10), Validators.required],
    fatherAnimalUuid: this.fb.control<string | null>(null),
    offspring: this.fb.array<CalfFormGroup>([this.createOffspringForm()]),
    notes: [''],
  });

  constructor() {
    this.animalsService.listAnimals({ ownerGanaderoId: this.data.ownerGanaderoId, active: true }).subscribe({
      next: (animals) => this.fatherOptions.set(animals.filter((animal) => animal.sex === ANIMAL_SEX.MACHO && animal.uuid !== this.data.motherUuid)),
      error: () => this.fatherOptions.set([]),
    });
  }

  animalName(animal: AnimalItem) { return animalName(animal); }

  get offspring(): FormArray<CalfFormGroup> { return this.form.controls.offspring; }

  addOffspring() { this.offspring.push(this.createOffspringForm()); }

  removeOffspring(index: number) {
    if (this.offspring.length > 1) {
      this.offspring.removeAt(index);
    }
  }

  submit() {
    if (this.form.invalid || this.saving() || !this.isOnline()) return;
    const value = this.form.getRawValue();
    const allCalvesHaveVisible = value.offspring.every((calf) => hasVisibleIdentifier(calf));
    if (!allCalvesHaveVisible) {
      this.errorMessage.set('Informá al menos arete, marca o tatuaje para cada ternero.');
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    this.animalsService.registerBirth(this.data.motherUuid, {
      birthDate: value.birthDate,
      fatherAnimalUuid: value.fatherAnimalUuid,
      notes: value.notes,
      offspring: value.offspring.map((calf) => ({
        arete: calf.arete,
        marca: calf.marca,
        tatuaje: calf.tatuaje,
        category: calf.category,
        sex: calf.category === ANIMAL_CATEGORY.TERNERA ? ANIMAL_SEX.HEMBRA : ANIMAL_SEX.MACHO,
        active: true,
        weightKg: calf.weightKg,
      })),
    }).subscribe({
      next: () => this.dialogRef.close(true),
      error: () => {
        this.errorMessage.set('No pudimos registrar el nacimiento. Revisá los datos o intentá de nuevo.');
        this.saving.set(false);
      },
    });
  }

  private createOffspringForm(): CalfFormGroup {
    return new FormGroup({
      arete: new FormControl('', { nonNullable: true }),
      marca: new FormControl('', { nonNullable: true }),
      tatuaje: new FormControl('', { nonNullable: true }),
      category: new FormControl<AnimalCategory>(ANIMAL_CATEGORY.TERNERA, { nonNullable: true, validators: [Validators.required] }),
      weightKg: new FormControl<number | null>(null),
    });
  }
}

function animalName(animal: AnimalItem | null | undefined) {
  return animal?.arete || animal?.marca || animal?.tatuaje || 'animal sin identificador';
}

function serviceEventOptionLabel(event: AnimalReproductionEventItem) {
  const metadata = event.metadata as Record<string, unknown>;
  const method = typeof metadata['serviceMethod'] === 'string'
    ? String(metadata['serviceMethod']).replaceAll('_', ' ')
    : 'método no informado';
  const sire = firstText(metadata['fatherAnimalUuid'], metadata['bullReference'], metadata['semenReference']);
  return `${event.occurredAt.slice(0, 10)} · ${method}${sire ? ` · ${sire}` : ''}`;
}

function buildActiveGestationSummary(events: AnimalReproductionEventItem[]): ActiveGestationSummary | null {
  const sortedEvents = [...events].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
  const positiveDiagnosis = sortedEvents.find((event) => {
    const metadata = event.metadata as Record<string, unknown>;
    return event.reproductionEventType === 'PREGNANCY_DIAGNOSIS'
      && metadata['result'] === PREGNANCY_DIAGNOSIS_RESULT.PRENADA
      && Boolean(firstText(metadata['expectedBirthDate']));
  });

  if (!positiveDiagnosis) {
    return null;
  }

  const hasLaterClosure = sortedEvents.some((event) =>
    event.occurredAt > positiveDiagnosis.occurredAt
    && (event.reproductionEventType === 'BIRTH' || event.reproductionEventType === 'PREGNANCY_LOSS')
  );
  if (hasLaterClosure) {
    return null;
  }

  const metadata = positiveDiagnosis.metadata as Record<string, unknown>;
  const expectedBirthDate = firstText(metadata['expectedBirthDate'])?.slice(0, 10);
  if (!expectedBirthDate) {
    return null;
  }

  const serviceEventUuid = firstText(metadata['serviceEventUuid']);
  const serviceEvent = serviceEventUuid
    ? events.find((event) => event.id === serviceEventUuid && event.reproductionEventType === 'SERVICE')
    : null;

  return {
    expectedBirthDate,
    statusLabel: gestationStatusLabel(expectedBirthDate),
    serviceLabel: serviceEvent ? serviceEventOptionLabel(serviceEvent) : null,
  } satisfies ActiveGestationSummary;
}

function gestationStatusLabel(expectedBirthDate: string) {
  const today = startOfDay(new Date());
  const expected = startOfDay(new Date(`${expectedBirthDate}T00:00:00`));
  const diffDays = Math.round((expected.getTime() - today.getTime()) / 86_400_000);
  if (diffDays > 0) return `Faltan ${diffDays} día(s)`;
  if (diffDays < 0) return `Vencida hace ${Math.abs(diffDays)} día(s)`;
  return 'Fecha probable hoy';
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function hasVisibleIdentifier(calf: { arete: string; marca: string; tatuaje: string }) {
  return [calf.arete, calf.marca, calf.tatuaje].some((visible) => visible.trim().length > 0);
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return null;
}

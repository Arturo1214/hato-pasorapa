import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators, type AbstractControl, type ValidationErrors, type ValidatorFn } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../../core/auth/data-access/auth.service';
import { FormErrorsComponent } from '../../../shared/ui/form-errors/form-errors.component';
import { GanaderosService } from '../ganaderos/data-access/ganaderos.service';
import { AnimalsImagesService, type AnimalImageItem } from './data-access/animals-images.service';
import {
  ANIMAL_CATEGORY,
  ANIMAL_CATEGORY_OPTIONS,
  ANIMAL_SEX,
  ANIMAL_SEX_OPTIONS,
  AnimalsService,
  inferAnimalSexFromCategory,
  type AnimalItem,
  type AnimalCategory,
  type AnimalSex,
  type AnimalMutationPayload,
} from './data-access/animals.service';
import type { AnimalOwnerOption } from './animal-form-dialog.component';

@Component({
  selector: 'app-animal-form-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    FormErrorsComponent,
  ],
  template: `
    <section class="animal-form-page">
      <div class="form-actions">
        <button mat-stroked-button type="button" (click)="goBack()"><mat-icon>arrow_back</mat-icon>Volver</button>
        <button mat-flat-button color="primary" type="button" [disabled]="form.invalid || saving()" (click)="submit()">
          <mat-icon>save</mat-icon>{{ isEdit() ? 'Guardar cambios' : 'Guardar animal' }}
        </button>
      </div>

      @if (errorMessage()) {
        <mat-card appearance="outlined" role="alert"><p>{{ errorMessage() }}</p></mat-card>
      }

      <div class="form-layout">
        <mat-card appearance="outlined" class="gallery-panel">
          @if (mainImage()) {
            <img class="main-image" [src]="mainImage()?.previewUrl" [alt]="imageAlt()" />
            <div class="thumbnail-strip" aria-label="Miniaturas del animal">
              @for (image of images(); track image.id) {
                <img [src]="image.previewUrl" [alt]="image.fileName" />
              }
            </div>
            <label class="image-picker">
              <span>Agregar imágenes</span>
              <input type="file" accept="image/jpeg,image/png" multiple />
            </label>
          } @else {
            <div class="image-placeholder"><mat-icon>pets</mat-icon><span>Sin foto principal</span></div>
            @if (!isEdit()) {
              <p class="image-note">Podrás agregar imágenes después de guardar.</p>
            } @else {
              <label class="image-picker">
                <span>Agregar imágenes</span>
                <input type="file" accept="image/jpeg,image/png" multiple />
              </label>
            }
          }
        </mat-card>

        <mat-card appearance="outlined" class="fields-panel">
          <form [formGroup]="form" class="animal-form">
            @if (canSelectOwner()) {
              <mat-form-field appearance="outline" class="form-field--full">
                <mat-label>Ganadero propietario</mat-label>
                <mat-select formControlName="ownerGanaderoId">
                  @for (owner of ownerOptions(); track owner.id) {
                    <mat-option [value]="owner.id">{{ owner.label }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            } @else {
              <div class="form-note form-field--full">El propietario se asignará automáticamente con tu sesión de ganadero.</div>
            }

            <mat-form-field appearance="outline"><mat-label>Arete</mat-label><input matInput formControlName="arete" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Marca</mat-label><input matInput formControlName="marca" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Tatuaje</mat-label><input matInput formControlName="tatuaje" /></mat-form-field>

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
              <mat-label>Estado</mat-label>
              <mat-select formControlName="active"><mat-option [value]="true">Activo</mat-option><mat-option [value]="false">Inactivo</mat-option></mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline"><mat-label>Fecha de nacimiento</mat-label><input matInput type="date" formControlName="birthDate" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Fecha de ingreso</mat-label><input matInput type="date" formControlName="admissionDate" /></mat-form-field>
            <mat-form-field appearance="outline"><mat-label>Peso (kg)</mat-label><input matInput type="number" min="0" formControlName="weightKg" /></mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Madre</mat-label>
              <mat-select formControlName="motherAnimalUuid">
                <mat-option [value]="null">Sin madre registrada</mat-option>
                @for (mother of motherOptions(); track mother.uuid) {
                  <mat-option [value]="mother.uuid">{{ parentLabel(mother) }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Padre</mat-label>
              <mat-select formControlName="fatherAnimalUuid">
                <mat-option [value]="null">Sin padre registrado</mat-option>
                @for (father of fatherOptions(); track father.uuid) {
                  <mat-option [value]="father.uuid">{{ parentLabel(father) }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <div class="parent-summary form-field--full">
              Progenitores disponibles: {{ parentOptionsLabel() }}. Los animales de primera generación pueden quedar sin madre/padre.
            </div>

            @if (canSelectOwner()) { <app-form-errors [control]="form.controls.ownerGanaderoId" [messages]="messages.ownerGanaderoId" /> }
            <app-form-errors [control]="form.controls.category" [messages]="messages.category" />
            <app-form-errors [control]="form.controls.sex" [messages]="messages.sex" />
            <app-form-errors [control]="form.controls.admissionDate" [messages]="messages.admissionDate" />
            <app-form-errors [control]="form.controls.weightKg" [messages]="messages.weightKg" />

            @if (showVisibleIdentifiersError()) { <div class="form-alert form-field--full">Indicá al menos un identificador visible: arete, marca o tatuaje.</div> }
            @if (showCategorySexError()) { <div class="form-alert form-field--full">La categoría seleccionada no es compatible con el sexo informado.</div> }
            @if (showBirthDateError()) { <div class="form-alert form-field--full">Ingresá la fecha de nacimiento para terneros/as.</div> }
          </form>
        </mat-card>
      </div>
    </section>
  `,
  styles: [`
    .animal-form-page { display: grid; gap: 1rem; padding: 1rem; }
    .form-actions { display: flex; justify-content: space-between; gap: 1rem; flex-wrap: wrap; }
    .form-actions mat-icon { margin-inline-end: .25rem; }
    .form-layout { display: grid; grid-template-columns: minmax(18rem, 24rem) minmax(0, 1fr); gap: 1rem; align-items: start; }
    .gallery-panel, .fields-panel { padding: 1rem; }
    .main-image, .image-placeholder { width: 100%; aspect-ratio: 4 / 3; border-radius: 1rem; }
    .main-image { object-fit: cover; }
    .image-placeholder { display: grid; place-items: center; background: color-mix(in srgb, var(--mat-sys-primary-container) 35%, var(--mat-sys-surface)); color: var(--mat-sys-on-surface-variant); }
    .thumbnail-strip { display: flex; gap: .75rem; margin-top: .75rem; overflow-x: auto; }
    .thumbnail-strip img { width: 5rem; height: 4rem; object-fit: cover; border-radius: .75rem; }
    .image-picker, .image-note { display: grid; margin-top: 1rem; }
    .animal-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 1rem; }
    .form-field--full { grid-column: 1 / -1; }
    .form-note, .parent-summary { padding: .875rem 1rem; border-radius: .75rem; background: rgba(33, 150, 243, .08); color: #0f3d66; font-weight: 500; }
    .form-alert { color: #b3261e; font-weight: 500; }
    @media (max-width: 900px) { .form-layout, .animal-form { grid-template-columns: minmax(0, 1fr); } }
  `],
})
export class AnimalFormPageComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly authService = inject(AuthService);
  private readonly animalsService = inject(AnimalsService);
  private readonly imagesService = inject(AnimalsImagesService);
  private readonly ganaderosService = inject(GanaderosService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly uuid = this.route.snapshot.paramMap.get('uuid');

  readonly categoryOptions = ANIMAL_CATEGORY_OPTIONS;
  readonly sexOptions = ANIMAL_SEX_OPTIONS;
  readonly animal = signal<AnimalItem | null>(null);
  readonly parentCandidates = signal<AnimalItem[]>([]);
  readonly ownerOptions = signal<AnimalOwnerOption[]>([]);
  readonly images = signal<AnimalImageItem[]>([]);
  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isEdit = computed(() => Boolean(this.uuid));
  readonly canSelectOwner = computed(() => this.authService.currentUser()?.role === 'ADMIN');
  readonly routeBase = computed(() => this.authService.currentUser()?.role === 'GANADERO' ? '/ganadero/animales' : '/admin/animales');
  readonly mainImage = computed(() => this.images().find((image) => Boolean(image.previewUrl)) ?? null);

  readonly form = this.formBuilder.group(
    {
      ownerGanaderoId: ['', this.canSelectOwner() ? [Validators.required] : []],
      motherAnimalUuid: [null as string | null],
      fatherAnimalUuid: [null as string | null],
      arete: [''],
      marca: [''],
      tatuaje: [''],
      category: [ANIMAL_CATEGORY.VACA as AnimalCategory, [Validators.required]],
      sex: [ANIMAL_SEX.HEMBRA as AnimalSex, [Validators.required]],
      active: [true, [Validators.required]],
      birthDate: [''],
      admissionDate: ['', [Validators.required]],
      weightKg: [null as number | null, [Validators.min(0)]],
    },
    { validators: [visibleIdentifierValidator, categorySexValidator, birthDateRequiredForYoungAnimalsValidator] },
  );

  readonly messages = {
    ownerGanaderoId: { required: 'Seleccioná el ganadero responsable.' },
    category: { required: 'Seleccioná la categoría actual del animal.' },
    sex: { required: 'Seleccioná el sexo del animal.' },
    admissionDate: { required: 'Ingresá la fecha de ingreso vigente.' },
    weightKg: { min: 'El peso no puede ser negativo.' },
  };

  constructor() { void this.load(); }

  goBack() { void this.router.navigateByUrl(this.uuid ? `${this.routeBase()}/${this.uuid}` : this.routeBase()); }

  parentLabel(animal: AnimalItem) { return [animal.arete, animal.marca].filter((value): value is string => Boolean(value)).join(' · ') || 'Animal sin identificador'; }

  motherOptions() { return this.parentCandidatesForSelectedOwner().filter((animal) => animal.sex === ANIMAL_SEX.HEMBRA); }

  fatherOptions() { return this.parentCandidatesForSelectedOwner().filter((animal) => animal.sex === ANIMAL_SEX.MACHO); }

  parentOptionsLabel() {
    const labels = [...this.motherOptions(), ...this.fatherOptions()].map((animal) => this.parentLabel(animal));
    return labels.length ? labels.join(', ') : 'sin candidatos cargados';
  }

  imageAlt() { return `Foto de ${this.animal()?.arete || this.form.controls.arete.value || 'animal sin identificador'}`; }

  showVisibleIdentifiersError() { return this.form.hasError('visibleIdentifierRequired') && (this.form.touched || this.form.dirty); }
  showCategorySexError() { return this.form.hasError('categorySexMismatch') && (this.form.touched || this.form.dirty); }
  showBirthDateError() { return this.form.hasError('birthDateRequiredForYoungAnimal') && (this.form.touched || this.form.dirty); }

  submit() {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.form.updateValueAndValidity();
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);
    const payload = this.buildPayload();
    const request$ = this.uuid ? this.animalsService.updateAnimal(this.uuid, payload) : this.animalsService.createAnimal(payload);
    request$.subscribe({
      next: (result) => {
        this.saving.set(false);
        if (result.outcome === 'blocked') {
          this.errorMessage.set(result.message);
          return;
        }
        const detailUuid = this.uuid ?? result.animalUuid;
        void this.router.navigateByUrl(detailUuid ? `${this.routeBase()}/${detailUuid}` : this.routeBase());
      },
      error: () => {
        this.saving.set(false);
        this.errorMessage.set('No pudimos guardar la ficha animal.');
      },
    });
  }

  private async load() {
    try {
      const [parents] = await Promise.all([firstValueFrom(this.animalsService.listAnimals()), this.loadOwnersIfNeeded()]);
      this.parentCandidates.set(parents);
      if (this.uuid) {
        const animal = await firstValueFrom(this.animalsService.getAnimal(this.uuid));
        this.animal.set(animal);
        this.form.patchValue({
          ownerGanaderoId: animal.ownerGanaderoId,
          motherAnimalUuid: animal.motherAnimalUuid ?? null,
          fatherAnimalUuid: animal.fatherAnimalUuid ?? null,
          arete: animal.arete ?? '',
          marca: animal.marca ?? '',
          tatuaje: animal.tatuaje ?? '',
          category: animal.category,
          sex: animal.sex ?? inferAnimalSexFromCategory(animal.category),
          active: animal.active,
          birthDate: animal.birthDate ?? '',
          admissionDate: animal.admissionDate,
          weightKg: animal.weightKg,
        });
        this.images.set((await firstValueFrom(this.imagesService.listImages(this.uuid))).filter((image) => Boolean(image.previewUrl)));
      } else if (this.ownerOptions()[0]) {
        this.form.controls.ownerGanaderoId.setValue(this.ownerOptions()[0].id);
      }
    } catch {
      this.errorMessage.set('No pudimos cargar los datos del formulario animal.');
    }
  }

  private async loadOwnersIfNeeded() {
    if (!this.canSelectOwner()) return;
    const ganaderos = await firstValueFrom(this.ganaderosService.listGanaderos());
    this.ownerOptions.set(ganaderos.map((ganadero) => ({ id: ganadero.id, label: `${ganadero.name} · ${ganadero.businessIdentifier}` })));
  }

  private buildPayload(): AnimalMutationPayload {
    const value = this.form.getRawValue();
    return {
      ownerGanaderoId: normalizeOptionalText(value.ownerGanaderoId),
      motherAnimalUuid: normalizeOptionalText(value.motherAnimalUuid),
      fatherAnimalUuid: normalizeOptionalText(value.fatherAnimalUuid),
      arete: normalizeOptionalText(value.arete),
      marca: normalizeOptionalText(value.marca),
      tatuaje: normalizeOptionalText(value.tatuaje),
      category: value.category ?? ANIMAL_CATEGORY.VACA,
      sex: value.sex ?? inferAnimalSexFromCategory(value.category ?? ANIMAL_CATEGORY.VACA),
      active: Boolean(value.active),
      birthDate: normalizeOptionalText(value.birthDate),
      admissionDate: value.admissionDate ?? '',
      weightKg: value.weightKg ?? null,
    };
  }

  private parentCandidatesForSelectedOwner() {
    const selectedOwnerGanaderoId = this.form.controls.ownerGanaderoId.value;
    return this.parentCandidates().filter((animal) => {
      const sameAnimal = this.uuid != null && animal.uuid === this.uuid;
      const sameOwner = !this.canSelectOwner() || !selectedOwnerGanaderoId || animal.ownerGanaderoId === selectedOwnerGanaderoId;
      return !sameAnimal && sameOwner;
    });
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
  return inferAnimalSexFromCategory((value.category as AnimalCategory) ?? ANIMAL_CATEGORY.VACA) === value.sex
    ? null
    : { categorySexMismatch: true };
};

const birthDateRequiredForYoungAnimalsValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = control.value as { category?: string | null; birthDate?: string | null };
  return (value.category === ANIMAL_CATEGORY.TERNERO || value.category === ANIMAL_CATEGORY.TERNERA) && !normalizeOptionalText(value.birthDate)
    ? { birthDateRequiredForYoungAnimal: true }
    : null;
};

function normalizeOptionalText(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

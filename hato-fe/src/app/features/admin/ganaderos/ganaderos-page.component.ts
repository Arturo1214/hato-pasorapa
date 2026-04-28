import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';
import { OfflineStatusService } from '../../../core/offline/offline-status.service';
import { FormErrorsComponent } from '../../../shared/ui/form-errors/form-errors.component';
import { GanaderosService, type GanaderoItem } from './data-access/ganaderos.service';

@Component({
  selector: 'app-ganaderos-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    FormErrorsComponent,
  ],
  template: `
    <section class="admin-page">
      <header class="page-header">
        <h1>Ganaderos</h1>
        <p>Registro básico, filtros de estado y baja administrativa.</p>
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
        @if (syncState().manualRefreshRequired) {
          <p>Necesitás refrescar manualmente la lista para resolver el conflicto remoto.</p>
        }
      </mat-card>

      <mat-card appearance="outlined">
        <mat-form-field appearance="outline">
          <mat-label>Filtro de estado</mat-label>
          <mat-select [value]="selectedFilter()" (valueChange)="changeFilter($event)">
            <mat-option value="ALL">Todos</mat-option>
            <mat-option value="ACTIVE">Activos</mat-option>
            <mat-option value="INACTIVE">Baja</mat-option>
          </mat-select>
          <mat-hint>Elegí si querés ver activos, dados de baja o todos.</mat-hint>
        </mat-form-field>
      </mat-card>

      <mat-card appearance="outlined">
        <form [formGroup]="createForm" class="form-grid" (ngSubmit)="submitCreate()">
          <mat-form-field appearance="outline">
            <mat-label>Identificador de negocio *</mat-label>
            <input matInput formControlName="businessIdentifier" required />
            <mat-hint>Usá el identificador único definido por negocio.</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label>Nombre del ganadero *</mat-label>
            <input matInput formControlName="name" required />
            <mat-hint>Este nombre se muestra en listados y confirmaciones administrativas.</mat-hint>
          </mat-form-field>

          <app-form-errors
            [control]="createForm.controls.businessIdentifier"
            [messages]="messages.businessIdentifier"
          />
          <app-form-errors [control]="createForm.controls.name" [messages]="messages.name" />

          <button
            mat-flat-button
            color="primary"
            type="submit"
            [disabled]="createForm.invalid || createSubmitting()"
          >
            {{ createSubmitting() ? 'Guardando…' : 'Registrar ganadero' }}
          </button>
        </form>
      </mat-card>

      @if (feedbackMessage()) {
        <mat-card appearance="outlined" role="status" aria-live="polite"><p>{{ feedbackMessage() }}</p></mat-card>
      }

      @if (errorMessage()) {
        <mat-card appearance="outlined" role="alert" aria-live="assertive"><p>{{ errorMessage() }}</p></mat-card>
      } @else if (!ganaderos().length) {
        <mat-card appearance="outlined"><p>Todavía no hay ganaderos registrados.</p></mat-card>
      } @else {
        <div class="cards-grid">
          @for (ganadero of ganaderos(); track ganadero.id) {
            <mat-card appearance="outlined">
              <h2>{{ ganadero.name }}</h2>
              <p>{{ ganadero.businessIdentifier }}</p>
              <p>Estado: {{ ganadero.active ? 'ACTIVO' : 'BAJA' }}</p>
              <button
                mat-button
                type="button"
                [disabled]="updatingStatusIds().includes(ganadero.id)"
                (click)="toggleStatus(ganadero)"
              >
                {{ ganadero.active ? 'Dar de baja' : 'Reactivar' }}
              </button>
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

      .form-grid,
      .cards-grid {
        display: grid;
        gap: 1rem;
      }

      .cards-grid {
        grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      }
    `,
  ],
})
export class GanaderosPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly ganaderosService = inject(GanaderosService);
  private readonly offlineStatus = inject(OfflineStatusService);

  readonly ganaderos = signal<GanaderoItem[]>([]);
  readonly errorMessage = signal<string | null>(null);
  readonly feedbackMessage = signal<string | null>(null);
  readonly createSubmitting = signal(false);
  readonly updatingStatusIds = signal<string[]>([]);
  readonly syncState = this.ganaderosService.syncState;
  readonly offlineMessage = this.offlineStatus.message;
  readonly syncSummary = computed(() => {
    const syncState = this.syncState();
    const lastSyncLabel = syncState.lastSyncAt ? ` · Última sync ${syncState.lastSyncAt}` : '';
    return `${syncState.pending} pendiente(s)${lastSyncLabel}`;
  });
  readonly selectedFilter = signal<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  readonly createForm = this.formBuilder.nonNullable.group({
    businessIdentifier: ['', [Validators.required]],
    name: ['', [Validators.required]],
  });

  readonly messages = {
    businessIdentifier: { required: 'Ingresá el identificador de negocio.' },
    name: { required: 'Ingresá el nombre del ganadero.' },
  };

  constructor() {
    this.loadGanaderos();
  }

  submitCreate() {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    this.feedbackMessage.set(null);
    this.createSubmitting.set(true);

    this.ganaderosService.createGanadero(this.createForm.getRawValue()).pipe(finalize(() => this.createSubmitting.set(false))).subscribe({
      next: (result) => {
        this.createForm.reset({ businessIdentifier: '', name: '' });
        this.errorMessage.set(null);
        this.feedbackMessage.set(result.message);
        this.loadGanaderos();
      },
      error: () => this.errorMessage.set('No pudimos guardar el ganadero.'),
    });
  }

  toggleStatus(ganadero: GanaderoItem) {
    this.feedbackMessage.set(null);
    this.updatingStatusIds.update((ids) => [...ids, ganadero.id]);

    this.ganaderosService.updateStatus(ganadero.id, !ganadero.active).pipe(
      finalize(() => this.updatingStatusIds.update((ids) => ids.filter((id) => id !== ganadero.id)))
    ).subscribe({
      next: (result) => {
        this.feedbackMessage.set(result.message);
        this.loadGanaderos();
      },
      error: () => this.errorMessage.set('No pudimos actualizar el estado del ganadero.'),
    });
  }

  changeFilter(filter: 'ALL' | 'ACTIVE' | 'INACTIVE') {
    this.selectedFilter.set(filter);
    this.loadGanaderos();
  }

  private loadGanaderos() {
    this.errorMessage.set(null);
    const activeFilter =
      this.selectedFilter() === 'ALL' ? undefined : this.selectedFilter() === 'ACTIVE';

    this.ganaderosService.listGanaderos(activeFilter).subscribe({
      next: (ganaderos) => this.ganaderos.set(ganaderos),
      error: () => {
        this.ganaderos.set([]);
        this.errorMessage.set('No pudimos cargar los ganaderos.');
      },
    });
  }
}

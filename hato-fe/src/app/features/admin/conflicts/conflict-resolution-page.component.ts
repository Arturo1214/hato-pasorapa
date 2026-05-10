import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { AdminConflictResolutionStore } from './data-access/admin-conflict-resolution.store';
import type { ManualResolutionAction } from '../../../core/offline/offline-types';

@Component({
  selector: 'app-conflict-resolution-page',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, MatButtonModule, MatCardModule, MatFormFieldModule, MatInputModule],
  template: `
    <section class="conflicts-page">
      <mat-card appearance="outlined">
        <p>Conflictos pendientes: {{ store.unresolvedCount() }}</p>
        @if (store.statusMessage()) {
          <p>{{ store.statusMessage() }}</p>
        }
        @if (store.error()) {
          <p>{{ store.error() }}</p>
        }
        <button mat-stroked-button type="button" (click)="refresh()">Refrescar conflictos</button>
      </mat-card>

      <div class="layout-grid">
        <mat-card appearance="outlined">
          <h2>Pendientes</h2>
          @if (!store.items().length) {
            <p>No hay conflictos pendientes.</p>
          } @else {
            @for (item of store.items(); track item.operationId) {
              <button mat-button type="button" class="conflict-link" (click)="store.select(item.operationId)">
                {{ item.entityType }} · {{ item.opType }} · {{ item.reason }}
              </button>
            }
          }
        </mat-card>

        <mat-card appearance="outlined">
          @if (selectedConflict()) {
            <h2>Detalle</h2>
            <p>Policy: {{ selectedConflict()!.policy?.policyKey ?? 'sin policy' }}</p>
            <p>{{ selectedConflict()!.policy?.uxHint }}</p>
            <h3>Diff visual</h3>
            @if (!selectedConflict()!.diffFields.length) {
              <p>Sin diff campo a campo; la resolución depende del motivo operativo.</p>
            } @else {
              @for (field of selectedConflict()!.diffFields; track field.path) {
                <article class="diff-field" [attr.data-severity]="field.severity">
                  <strong>{{ field.path }}</strong>
                  <p>Local: {{ formatValue(field.localValue) }}</p>
                  <p>Server: {{ formatValue(field.serverValue) }}</p>
                </article>
              }
            }

            <form [formGroup]="resolutionForm" class="resolution-form">
              <mat-form-field appearance="outline">
                <mat-label>Motivo obligatorio</mat-label>
                <textarea matInput rows="4" formControlName="reason"></textarea>
              </mat-form-field>
            </form>

            <div class="actions-row">
              @for (action of selectedConflict()!.allowedActions; track action) {
                <button mat-flat-button color="primary" type="button" [attr.data-action]="action" (click)="resolve(action)">
                  {{ action }}
                </button>
              }
            </div>
          } @else {
            <p>Seleccioná un conflicto para ver el diff visual y las acciones permitidas.</p>
          }
        </mat-card>
      </div>
    </section>
  `,
  styles: [
    `
      .conflicts-page,
      .layout-grid,
      .resolution-form,
      .actions-row,
      .diff-field {
        display: grid;
        gap: 0.75rem;
      }

      .conflicts-page {
        padding: 1rem;
      }
    `,
  ],
})
export class ConflictResolutionPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  readonly store = inject(AdminConflictResolutionStore);
  readonly selectedConflict = this.store.selectedConflict;
  readonly resolutionForm = this.formBuilder.nonNullable.group({
    reason: ['', [Validators.required, Validators.maxLength(500)]],
  });

  constructor() {
    void this.store.initialize();
  }

  async refresh() {
    await this.store.refreshNow();
  }

  async resolve(action: ManualResolutionAction) {
    if (this.resolutionForm.invalid) {
      this.resolutionForm.markAllAsTouched();
      return;
    }

    await this.store.resolveSelected(action, this.resolutionForm.getRawValue().reason);
    this.resolutionForm.reset({ reason: '' });
  }

  formatValue(value: unknown) {
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
}

import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import type { VetVisitItem } from './data-access/vet-visits.service';
import { DateTimeClock } from './vet-visit-form-dialog.component';

export interface VetVisitDetailDialogData {
  visit: VetVisitItem;
  chain: VetVisitItem[];
}

@Component({
  selector: 'app-vet-visit-detail-dialog',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatDialogModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Detalle de visita veterinaria</h2>

    <mat-dialog-content class="detail-dialog">
      <section class="detail-panel" aria-label="Resumen de la visita">
        <div>
          <span class="field-label">Visita</span><strong>{{ data.visit.visitId }}</strong>
        </div>
        <div>
          <span class="field-label">Estado</span><strong>{{ statusLabel(data.visit) }}</strong>
        </div>
        <div>
          <span class="field-label">Cadena / protocolo</span
          ><strong>{{ chainStatusLabel(data.visit) }}</strong>
        </div>
        <div>
          <span class="field-label">Fecha</span
          ><strong>{{ formatDateTime(data.visit.occurredAt) }}</strong>
        </div>
        <div>
          <span class="field-label">Veterinario</span
          ><strong>{{ veterinarianLabel(data.visit) }}</strong>
        </div>
        <div>
          <span class="field-label">Modo</span><strong>{{ modeLabel(data.visit) }}</strong>
        </div>
      </section>

      <section class="detail-section" aria-label="Detalle clínico">
        <h3>Detalle clínico</h3>
        <dl>
          <div>
            <dt>Motivo / descripción</dt>
            <dd>{{ data.visit.atencionNotas ?? '—' }}</dd>
          </div>
          <div>
            <dt>Hallazgos</dt>
            <dd>{{ data.visit.findings ?? '—' }}</dd>
          </div>
          <div>
            <dt>Notas de atención</dt>
            <dd>{{ data.visit.atencionNotas ?? '—' }}</dd>
          </div>
          <div>
            <dt>Costo</dt>
            <dd>{{ costLabel(data.visit) }}</dd>
          </div>
          <div>
            <dt>Plan de tratamiento</dt>
            <dd>
              @if (data.visit.treatmentPlan?.length) {
                <ol>
                  @for (step of data.visit.treatmentPlan; track step) {
                    <li>{{ step }}</li>
                  }
                </ol>
              } @else {
                —
              }
            </dd>
          </div>
          <div>
            <dt>Motivo de cancelación</dt>
            <dd>{{ data.visit.cancelReason ?? '—' }}</dd>
          </div>
          <div>
            <dt>Próximo control</dt>
            <dd>{{ nextScheduledVisitLabel() }}</dd>
          </div>
        </dl>
      </section>

      <section class="detail-section" aria-label="Historial vinculado">
        <h3>Historial vinculado</h3>
        <div class="chain-list">
          @for (visit of chainItems(); track visit.visitId) {
            <article class="chain-card">
              <header>
                <strong>{{ visit.visitId }}</strong
                ><span>{{ statusLabel(visit) }}</span>
              </header>
              <p>{{ formatDateTime(visit.occurredAt) }} · {{ veterinarianLabel(visit) }}</p>
              @if (visit.status === 'ATTENDED') {
                <p><strong>Hallazgos:</strong> {{ visit.findings ?? '—' }}</p>
                <p><strong>Notas:</strong> {{ visit.atencionNotas ?? '—' }}</p>
              }
              @if (visit.status === 'CANCELED') {
                <p><strong>Motivo de cancelación:</strong> {{ visit.cancelReason ?? '—' }}</p>
              }
              @if (visit.status === 'PENDING') {
                <p>
                  <strong>Próximo control programado:</strong>
                  {{ formatDateTime(visit.occurredAt) }}
                </p>
              }
            </article>
          }
        </div>
      </section>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-flat-button type="button" (click)="dialogRef.close()">
        <mat-icon>visibility</mat-icon>Cerrar
      </button>
    </mat-dialog-actions>
  `,
  styles: [
    `
      .detail-dialog {
        display: grid;
        gap: 1rem;
        max-height: min(82vh, 52rem);
        overflow: auto;
      }
      .detail-panel {
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 1rem;
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        padding: 1rem;
      }
      .field-label {
        color: var(--mat-sys-on-surface-variant);
        display: block;
        font-size: 0.8rem;
        margin-bottom: 0.25rem;
      }
      .detail-section {
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 1rem;
        padding: 1rem;
      }
      .detail-section h3 {
        margin: 0 0 0.75rem;
      }
      dl {
        display: grid;
        gap: 0.75rem;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        margin: 0;
      }
      dt {
        color: var(--mat-sys-on-surface-variant);
        font-weight: 700;
      }
      dd {
        margin: 0.25rem 0 0;
      }
      ol {
        margin: 0.25rem 0 0;
        padding-inline-start: 1.25rem;
      }
      .chain-list {
        display: grid;
        gap: 0.75rem;
      }
      .chain-card {
        border: 1px solid rgba(0, 0, 0, 0.12);
        border-radius: 0.75rem;
        padding: 0.75rem;
      }
      .chain-card header {
        display: flex;
        gap: 0.75rem;
        justify-content: space-between;
      }
      @media (max-width: 720px) {
        .detail-panel,
        dl {
          grid-template-columns: minmax(0, 1fr);
        }
      }
    `,
  ],
})
export class VetVisitDetailDialogComponent {
  readonly data = inject<VetVisitDetailDialogData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<VetVisitDetailDialogComponent>);
  private readonly clock = inject(DateTimeClock);

  chainItems() {
    return this.data.chain.length ? this.data.chain : [this.data.visit];
  }
  statusLabel(visit: VetVisitItem) {
    return VISIT_STATUS_LABELS[visit.status] ?? visit.status;
  }
  modeLabel(visit: VetVisitItem) {
    return visit.mode === 'GLOBAL' ? 'Campaña' : 'Específica';
  }
  chainStatusLabel(visit: VetVisitItem) {
    return visit.chainStatus === 'CLOSED'
      ? 'Cadena cerrada'
      : visit.chainStatus === 'OPEN'
        ? 'Cadena abierta'
        : '—';
  }
  veterinarianLabel(visit: VetVisitItem) {
    return visit.veterinarian
      ? [visit.veterinarian.name, visit.veterinarian.license].filter(Boolean).join(' · ')
      : '—';
  }
  costLabel(visit: VetVisitItem) {
    return visit.costo === null ? '—' : `${visit.costo} ${visit.costCurrency ?? 'BOB'}`;
  }
  nextScheduledVisitLabel() {
    const nextVisit = this.chainItems().find(
      (visit) => visit.parentVisitId === this.data.visit.visitId && visit.status === 'PENDING',
    );
    return nextVisit
      ? this.formatDateTime(nextVisit.occurredAt)
      : this.formatDateTime(this.data.visit.nextControlAt);
  }
  formatDateTime(value: string | null) {
    this.clock.nowIso();
    return value
      ? new Intl.DateTimeFormat('es-BO', { dateStyle: 'short', timeStyle: 'short' }).format(
          new Date(value),
        )
      : '—';
  }
}

const VISIT_STATUS_LABELS: Record<string, string> = {
  PENDING: 'Programada',
  ATTENDED: 'Atendida',
  RESCHEDULED: 'Reprogramada',
  FINALIZED: 'Finalizada',
  CANCELED: 'Cancelada',
};

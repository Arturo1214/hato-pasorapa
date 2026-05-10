import { CommonModule, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { GanaderoNotificationsStore } from './data-access/ganadero-notifications.store';

@Component({
  selector: 'app-ganadero-inbox-page',
  imports: [CommonModule, DatePipe, MatButtonModule, MatCardModule, MatIconModule, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="inbox-shell">
      <mat-card appearance="outlined" class="inbox-summary">
        <div>
          <p class="eyebrow">Notificaciones</p>
          <h2>Bandeja de notificaciones</h2>
          <p>Consultá los avisos recibidos y marcá como leídos los que ya revisaste.</p>
        </div>

        <div class="summary-actions">
          <strong>{{ unreadCount() }} sin leer</strong>
          <button
            mat-flat-button
            color="primary"
            data-testid="mark-all-read"
            type="button"
            [disabled]="unreadCount() === 0"
            (click)="markAllAsRead()"
          >
            Marcar todas como leídas
          </button>
        </div>
      </mat-card>

      @if (loading()) {
        <mat-card appearance="outlined" class="state-card">
          <mat-spinner diameter="32" />
          <span>Cargando notificaciones</span>
        </mat-card>
      }

      @if (error()) {
        <mat-card appearance="outlined" class="state-card state-card--error">
          <mat-icon>error</mat-icon>
          <span>{{ error() }}</span>
        </mat-card>
      }

      @if (inboxItems().length === 0) {
        <mat-card appearance="outlined" class="state-card">
          <mat-icon>notifications_none</mat-icon>
          <span>Todavía no recibiste notificaciones.</span>
        </mat-card>
      } @else {
        <div class="notification-list">
          @for (notification of inboxItems(); track notification.recipientId) {
            <mat-card appearance="outlined" class="notification-card" [class.notification-card--unread]="!notification.read">
              <div class="notification-card__content">
                <div class="notification-card__title-row">
                  <h3>{{ notification.title }}</h3>
                  <span class="status-pill" [class.status-pill--unread]="!notification.read">
                    {{ notification.read ? 'Leída' : 'No leída' }}
                  </span>
                </div>
                <p>{{ notification.body }}</p>
                <small>Enviada el {{ notification.publishedAt | date: 'dd/MM/yyyy HH:mm' }}</small>
              </div>

              @if (!notification.read) {
                <button
                  mat-stroked-button
                  type="button"
                  data-testid="mark-one-read"
                  (click)="markAsRead(notification.recipientId)"
                >
                  Marcar como leída
                </button>
              }
            </mat-card>
          }
        </div>
      }
    </section>
  `,
  styles: [
    `
      .inbox-shell {
        display: grid;
        gap: 1rem;
        padding: 1rem;
      }

      .inbox-summary,
      .notification-card,
      .state-card {
        border-radius: 24px;
      }

      .inbox-summary {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 1.25rem;
      }

      .eyebrow {
        margin: 0 0 0.25rem;
        color: var(--mat-sys-primary);
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }

      h2,
      h3,
      p {
        margin-top: 0;
      }

      .summary-actions {
        align-items: flex-end;
        display: grid;
        gap: 0.75rem;
        justify-items: end;
      }

      .notification-list {
        display: grid;
        gap: 0.75rem;
      }

      .notification-card {
        display: flex;
        justify-content: space-between;
        gap: 1rem;
        padding: 1rem;
      }

      .notification-card--unread {
        border-color: var(--mat-sys-primary);
        background: color-mix(in srgb, var(--mat-sys-primary-container) 35%, transparent 65%);
      }

      .notification-card__content {
        display: grid;
        gap: 0.35rem;
      }

      .notification-card__title-row,
      .state-card {
        align-items: center;
        display: flex;
        gap: 0.75rem;
      }

      .status-pill {
        border-radius: 999px;
        background: var(--mat-sys-surface-container-highest);
        font-size: 0.75rem;
        font-weight: 700;
        padding: 0.25rem 0.65rem;
      }

      .status-pill--unread {
        background: var(--mat-sys-primary);
        color: var(--mat-sys-on-primary);
      }

      .state-card {
        padding: 1rem;
      }

      .state-card--error {
        color: var(--mat-sys-error);
      }

      @media (max-width: 767px) {
        .inbox-summary,
        .notification-card {
          display: grid;
        }

        .summary-actions {
          justify-items: stretch;
        }
      }
    `,
  ],
})
export class GanaderoInboxPageComponent {
  readonly store = inject(GanaderoNotificationsStore);
  readonly inboxItems = toSignal(toObservable(this.store.items), { initialValue: [] });
  readonly loading = toSignal(toObservable(this.store.loading), { initialValue: false });
  readonly error = toSignal(toObservable(this.store.error), { initialValue: null });
  readonly unreadCount = toSignal(toObservable(this.store.unreadCount), { initialValue: 0 });

  constructor() {
    void this.store.refresh();
  }

  markAsRead(recipientId: string) {
    void this.store.markAsRead(recipientId);
  }

  markAllAsRead() {
    void this.store.markAllAsRead();
  }
}

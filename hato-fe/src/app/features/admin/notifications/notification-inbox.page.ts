import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { finalize } from 'rxjs';
import { AuthService } from '../../../core/auth/data-access/auth.service';
import { OfflineStatusService } from '../../../core/offline/offline-status.service';
import {
  AdminNotificationsService,
  type AdminNotificationRecipientOption,
  type AdminNotificationRecord,
  type AdminNotificationTargetingMode,
} from './data-access/admin-notifications.service';
import { NotificationInboxStore } from './data-access/notification-inbox.store';

@Component({
  selector: 'app-notification-inbox-page',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="notifications-page">
      <header class="page-header">
        <h1>Notificaciones</h1>
        <p>Inbox offline-first para avisos recibidos por el ganadero en campo.</p>
      </header>

      <mat-card appearance="outlined">
        <p>No leídas: {{ inboxStore.unreadCount() }}</p>
        <p>Copy UX: leído solo en este dispositivo.</p>
        <button mat-stroked-button type="button" (click)="refresh()">Refrescar inbox</button>
      </mat-card>

      @if (adminMode()) {
        <mat-card appearance="outlined">
          <h2>Nueva notificación</h2>
          @if (offlineMessage()) {
            <p>{{ offlineMessage() }}</p>
          }
          <form [formGroup]="createForm" class="form-grid" (ngSubmit)="submitCreate()">
            <mat-form-field appearance="outline">
              <mat-label>Título *</mat-label>
              <input matInput formControlName="title" required />
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Mensaje *</mat-label>
              <textarea matInput rows="4" formControlName="body" required></textarea>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Targeting *</mat-label>
              <mat-select formControlName="targetingMode">
                <mat-option value="ALL_ACTIVE_GANADEROS">Todos los GANADERO activos</mat-option>
                <mat-option value="EXPLICIT_LIST">Lista explícita</mat-option>
              </mat-select>
            </mat-form-field>

            @if (createForm.controls.targetingMode.value === 'EXPLICIT_LIST') {
              <mat-form-field appearance="outline">
                <mat-label>Destinatarios explícitos</mat-label>
                <mat-select formControlName="includeUserIds" multiple>
                  @for (recipient of recipients(); track recipient.id) {
                    <mat-option [value]="recipient.id">{{ recipient.displayName }} · {{ recipient.username }}</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            }

            <mat-form-field appearance="outline">
              <mat-label>Excluir destinatarios</mat-label>
              <mat-select formControlName="excludeUserIds" multiple>
                @for (recipient of recipients(); track recipient.id) {
                  <mat-option [value]="recipient.id">{{ recipient.displayName }} · {{ recipient.username }}</mat-option>
                }
              </mat-select>
            </mat-form-field>

            <button mat-flat-button color="primary" type="submit" [disabled]="createSubmitting() || !!offlineMessage()">
              {{ createSubmitting() ? 'Publicando…' : 'Publicar notificación' }}
            </button>
          </form>
        </mat-card>

        <mat-card appearance="outlined">
          <h2>Historial emitido</h2>
          @if (!history().length) {
            <p>Todavía no hay notificaciones emitidas.</p>
          } @else {
            @for (notification of history(); track notification.id) {
              <article class="history-item">
                <strong>{{ notification.title }}</strong>
                <p>{{ notification.body }}</p>
                <small>{{ notification.targetingMode }} · {{ notification.recipientCount }} destinatario(s)</small>
              </article>
            }
          }
        </mat-card>
      }

      @if (feedbackMessage()) {
        <mat-card appearance="outlined"><p>{{ feedbackMessage() }}</p></mat-card>
      }

      @if (errorMessage()) {
        <mat-card appearance="outlined"><p>{{ errorMessage() }}</p></mat-card>
      }

      <mat-card appearance="outlined">
        <h2>Bandeja local</h2>
        @if (!inboxItems().length) {
          <p>No hay notificaciones visibles en este dispositivo.</p>
        } @else {
          @for (item of inboxItems(); track item.id) {
            <article class="inbox-item" [attr.data-read]="item.read">
              <strong>{{ item.title }}</strong>
              <p>{{ item.body }}</p>
              <small>{{ item.read ? 'Leída en este dispositivo' : 'Pendiente de lectura' }}</small>
              @if (!item.read) {
                <button mat-button type="button" (click)="markAsRead(item.id)">Marcar como leída</button>
              }
            </article>
          }
        }
      </mat-card>
    </section>
  `,
  styles: [
    `
      .notifications-page {
        display: grid;
        gap: 1rem;
        padding: 1rem;
      }

      .form-grid,
      .history-item,
      .inbox-item {
        display: grid;
        gap: 0.75rem;
      }
    `,
  ],
})
export class NotificationInboxPageComponent {
  private readonly formBuilder = inject(FormBuilder);
  private readonly authService = inject(AuthService);
  private readonly adminNotificationsService = inject(AdminNotificationsService);
  private readonly offlineStatus = inject(OfflineStatusService);

  readonly adminMode = input(false);

  readonly inboxStore = inject(NotificationInboxStore);
  readonly inboxItems = this.inboxStore.items;
  readonly offlineMessage = this.offlineStatus.message;
  readonly createSubmitting = signal(false);
  readonly history = signal<AdminNotificationRecord[]>([]);
  readonly recipients = signal<AdminNotificationRecipientOption[]>([]);
  readonly feedbackMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly isAdmin = computed(() => this.authService.currentUser()?.role === 'ADMIN');

  readonly createForm = this.formBuilder.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(160)]],
    body: ['', [Validators.required, Validators.maxLength(2000)]],
    targetingMode: this.formBuilder.nonNullable.control<AdminNotificationTargetingMode>('ALL_ACTIVE_GANADEROS', {
      validators: [Validators.required],
    }),
    includeUserIds: [[] as string[]],
    excludeUserIds: [[] as string[]],
  });

  constructor() {
    if (this.adminMode() || this.isAdmin()) {
      this.loadAdminData();
    }

    this.adminNotificationsService.markAllAsRead().subscribe({
      next: () => void this.inboxStore.rebuild('mark-read'),
      error: () => undefined,
    });
  }

  refresh() {
    void this.inboxStore.rebuild('manual');
    if (this.isAdmin()) {
      this.loadHistory();
    }
  }

  submitCreate() {
    if (this.createForm.invalid) {
      this.createForm.markAllAsTouched();
      return;
    }

    if (this.createForm.controls.targetingMode.value === 'EXPLICIT_LIST' && !this.createForm.controls.includeUserIds.value.length) {
      this.errorMessage.set('Seleccioná al menos un destinatario explícito.');
      return;
    }

    this.createSubmitting.set(true);
    this.errorMessage.set(null);
    this.feedbackMessage.set(null);

    this.adminNotificationsService
      .createNotification(this.createForm.getRawValue())
      .pipe(finalize(() => this.createSubmitting.set(false)))
      .subscribe({
        next: () => {
          this.feedbackMessage.set('Notificación publicada correctamente.');
          this.createForm.reset({
            title: '',
            body: '',
            targetingMode: 'ALL_ACTIVE_GANADEROS',
            includeUserIds: [],
            excludeUserIds: [],
          });
          this.loadHistory();
        },
        error: () => this.errorMessage.set('No pudimos publicar la notificación.'),
      });
  }

  markAsRead(notificationId: string) {
    this.adminNotificationsService.markRecipientAsRead(notificationId).subscribe({
      next: () => undefined,
      error: () => undefined,
    });
    void this.inboxStore.markAsRead(notificationId);
  }

  private loadAdminData() {
    this.loadHistory();
    this.adminNotificationsService.listActiveGanaderoRecipients().subscribe({
      next: (recipients) => this.recipients.set(recipients),
      error: () => this.errorMessage.set('No pudimos cargar el padrón de destinatarios activos.'),
    });
  }

  private loadHistory() {
    this.adminNotificationsService.listHistory().subscribe({
      next: (history) => this.history.set(history),
      error: () => this.errorMessage.set('No pudimos cargar el historial de notificaciones.'),
    });
  }
}

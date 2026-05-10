import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom, forkJoin } from 'rxjs';
import { GanaderoNotificationsService, type GanaderoNotificationInboxItem } from './ganadero-notifications.service';

const INBOX_ERROR_MESSAGE = 'No pudimos cargar tus notificaciones. Intentá nuevamente.';

@Injectable({ providedIn: 'root' })
export class GanaderoNotificationsStore {
  private readonly service = inject(GanaderoNotificationsService);
  private readonly itemsState = signal<GanaderoNotificationInboxItem[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly unreadCountState = signal(0);

  readonly items = this.itemsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly unreadCount = this.unreadCountState.asReadonly();
  readonly hasUnread = computed(() => this.unreadCountState() > 0);

  async refresh() {
    this.loadingState.set(true);
    this.errorState.set(null);

    try {
      const { items, unreadCount } = await firstValueFrom(
        forkJoin({
          items: this.service.getInbox(),
          unreadCount: this.service.getUnreadCount(),
        })
      );

      this.itemsState.set(items);
      this.unreadCountState.set(unreadCount);
    } catch {
      this.errorState.set(INBOX_ERROR_MESSAGE);
    } finally {
      this.loadingState.set(false);
    }
  }

  async refreshUnreadCount() {
    try {
      this.unreadCountState.set(await firstValueFrom(this.service.getUnreadCount()));
    } catch {
      this.errorState.set(INBOX_ERROR_MESSAGE);
    }
  }

  async markAsRead(recipientId: string) {
    await firstValueFrom(this.service.markAsRead(recipientId));
    await this.refresh();
  }

  async markAllAsRead() {
    await firstValueFrom(this.service.markAllAsRead());
    await this.refresh();
  }
}

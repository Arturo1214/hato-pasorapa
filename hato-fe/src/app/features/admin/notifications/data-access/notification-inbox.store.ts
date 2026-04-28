import { computed, Injectable, signal } from '@angular/core';
import { DEFAULT_OFFLINE_STORE_SERVICE, OfflineStoreService } from '../../../../core/offline/offline-store.service';
import { NOTIFICATIONS_REFRESH_EVENT } from '../../../../core/offline/sync-orchestrator.service';
import type { NotificationSnapshot } from '../../../../core/offline/offline-types';

export interface NotificationInboxItem extends NotificationSnapshot {
  read: boolean;
  readAt: string | null;
}

export type NotificationInboxRefreshReason = 'startup' | 'post-sync' | 'manual' | 'mark-read';

@Injectable({ providedIn: 'root' })
export class NotificationInboxStore {
  private offlineStore: OfflineStoreService = DEFAULT_OFFLINE_STORE_SERVICE;
  private windowRef: Pick<Window, 'addEventListener'> | undefined = globalThis.window;
  private initialized = false;

  private readonly itemsState = signal<NotificationInboxItem[]>([]);
  private readonly loadingState = signal(false);
  private readonly errorState = signal<string | null>(null);
  private readonly lastReasonState = signal<NotificationInboxRefreshReason | null>(null);

  readonly items = this.itemsState.asReadonly();
  readonly loading = this.loadingState.asReadonly();
  readonly error = this.errorState.asReadonly();
  readonly lastReason = this.lastReasonState.asReadonly();
  readonly unreadCount = computed(() => this.itemsState().filter((item) => !item.read).length);
  readonly badgeSeverity = computed(() => (this.unreadCount() > 0 ? ('info' as const) : null));

  configureForTesting(dependencies: Partial<{ offlineStore: OfflineStoreService; windowRef: Pick<Window, 'addEventListener'> }>) {
    this.offlineStore = dependencies.offlineStore ?? this.offlineStore;
    this.windowRef = dependencies.windowRef ?? this.windowRef;
  }

  async initialize() {
    if (!this.initialized) {
      this.initialized = true;
      this.windowRef?.addEventListener(NOTIFICATIONS_REFRESH_EVENT, () => {
        void this.rebuild('post-sync');
      });
    }

    await this.rebuild('startup');
  }

  async rebuild(reason: NotificationInboxRefreshReason) {
    this.loadingState.set(true);
    this.errorState.set(null);

    try {
      const snapshots = (await this.offlineStore.listSnapshots('NOTIFICATION')).map(
        (snapshot) => snapshot.payload as unknown as NotificationSnapshot
      );
      const readState = await this.offlineStore.getNotificationReadState();
      const items = snapshots
        .map((snapshot) => ({
          ...snapshot,
          readAt: readState.readAtById[snapshot.id] ?? null,
          read: !!readState.readAtById[snapshot.id],
        }))
        .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt) || right.id.localeCompare(left.id));

      this.itemsState.set(items);
      this.lastReasonState.set(reason);
    } catch {
      this.errorState.set('No pudimos reconstruir la bandeja local de notificaciones.');
    } finally {
      this.loadingState.set(false);
    }
  }

  async markAsRead(notificationId: string) {
    await this.offlineStore.markNotificationRead(notificationId);
    await this.rebuild('mark-read');
  }
}

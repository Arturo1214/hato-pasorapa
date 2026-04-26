import { Injectable, computed, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class OfflineStatusService {
  private readonly online = signal(this.readInitialOnlineState());

  readonly isOnline = computed(() => this.online());
  readonly isOffline = computed(() => !this.online());
  readonly message = computed(() =>
    this.isOffline()
      ? 'Modo sin conexión. La shell instalada sigue disponible mientras recuperamos la conectividad.'
      : null
  );

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.online.set(true));
      window.addEventListener('offline', () => this.online.set(false));
    }
  }

  private readInitialOnlineState() {
    return typeof navigator === 'undefined' ? true : navigator.onLine;
  }
}

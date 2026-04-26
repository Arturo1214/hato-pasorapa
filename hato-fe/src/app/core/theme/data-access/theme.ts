import { isPlatformBrowser } from '@angular/common';
import { effect, inject, Injectable, PLATFORM_ID, signal } from '@angular/core';

export type ThemeMode = 'light' | 'dark';

@Injectable({
  providedIn: 'root',
})
export class ThemeService {
  private readonly platformId = inject(PLATFORM_ID);
  readonly currentTheme = signal<ThemeMode>('light');

  constructor() {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    this.loadStoredTheme();

    effect(() => {
      const theme = this.currentTheme();
      document.documentElement.classList.toggle('dark-theme', theme === 'dark');
      document.documentElement.classList.toggle('light-theme', theme === 'light');
      this.storage()?.setItem('hato-theme', theme);
    });
  }

  toggleTheme() {
    this.currentTheme.update((current) => (current === 'light' ? 'dark' : 'light'));
  }

  private loadStoredTheme() {
    const storedTheme = this.storage()?.getItem('hato-theme') as ThemeMode | null;
    const prefersDark = typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
      : false;
    this.currentTheme.set(storedTheme ?? (prefersDark ? 'dark' : 'light'));
  }

  private storage() {
    const storage = globalThis.localStorage as Partial<Storage> | undefined;
    if (!storage?.getItem || !storage.setItem) {
      return null;
    }

    return storage as Pick<Storage, 'getItem' | 'setItem'>;
  }
}

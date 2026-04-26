import { Injectable, signal } from '@angular/core';

export interface ApplicationRuntimeConfig {
  appName: string;
  domain: string;
  apiBaseUrl: string;
}

@Injectable({
  providedIn: 'root',
})
export class ApplicationConfigService {
  private readonly runtimeConfig = signal<ApplicationRuntimeConfig>({
    appName: 'Hato FE',
    domain: 'bo.pasorapa.hato',
    apiBaseUrl: '/api',
  });

  readonly config = this.runtimeConfig.asReadonly();

  bootstrap() {
    document.title = this.runtimeConfig().appName;
    document.documentElement.lang = 'es';
  }
}

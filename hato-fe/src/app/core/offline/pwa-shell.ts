export interface PwaManifestIconDefinition {
  src: string;
  sizes: string;
  type: string;
  purpose?: string;
}

export interface PwaManifestDefinition {
  name: string;
  short_name: string;
  start_url: string;
  display: 'standalone';
  background_color: string;
  theme_color: string;
  description: string;
  icons: PwaManifestIconDefinition[];
}

export const HATO_SERVICE_WORKER_SCRIPT = 'ngsw-worker.js';

export const HATO_PWA_MANIFEST: PwaManifestDefinition = {
  name: 'Hato',
  short_name: 'Hato',
  start_url: '/',
  display: 'standalone',
  background_color: '#0f172a',
  theme_color: '#0f172a',
  description: 'Shell instalable y base offline del panel Hato.',
  icons: [
    {
      src: '/icons/icon-192.svg',
      sizes: '192x192',
      type: 'image/svg+xml',
      purpose: 'any',
    },
    {
      src: '/icons/icon-512.svg',
      sizes: '512x512',
      type: 'image/svg+xml',
      purpose: 'any maskable',
    },
  ],
};

export function createServiceWorkerRegistrationOptions(isDevelopmentMode: boolean) {
  return {
    enabled: !isDevelopmentMode,
    registrationStrategy: 'registerWhenStable:30000',
  } as const;
}

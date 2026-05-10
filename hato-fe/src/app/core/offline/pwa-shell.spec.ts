import { TestBed } from '@angular/core/testing';
import { OfflineBannerComponent } from './offline-banner.component';
import { OfflineStatusService } from './offline-status.service';
import {
  HATO_PWA_MANIFEST,
  HATO_SERVICE_WORKER_SCRIPT,
  createServiceWorkerRegistrationOptions,
} from './pwa-shell';

describe('PWA shell foundation', () => {
  afterEach(() => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });
  });

  it('should expose installability metadata with name, start url, display mode and icons', () => {
    expect(HATO_PWA_MANIFEST.name).toBe('Hato');
    expect(HATO_PWA_MANIFEST.start_url).toBe('/');
    expect(HATO_PWA_MANIFEST.display).toBe('standalone');
    expect(HATO_PWA_MANIFEST.icons).toHaveLength(2);
  });

  it('should register the Angular service worker shell through ngsw-worker.js', () => {
    expect(HATO_SERVICE_WORKER_SCRIPT).toBe('ngsw-worker.js');
    expect(createServiceWorkerRegistrationOptions(false, 'hato.bo')).toEqual({
      enabled: true,
      registrationStrategy: 'registerWhenStable:30000',
    });
    expect(createServiceWorkerRegistrationOptions(true).enabled).toBe(false);
    expect(createServiceWorkerRegistrationOptions(false, 'localhost').enabled).toBe(false);
    expect(createServiceWorkerRegistrationOptions(false, '127.0.0.1').enabled).toBe(false);
  });

  it('should render a visible offline indicator when connectivity is lost after a cached session', async () => {
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: true,
    });

    await TestBed.configureTestingModule({
      imports: [OfflineBannerComponent],
      providers: [OfflineStatusService],
    }).compileComponents();

    const fixture = TestBed.createComponent(OfflineBannerComponent);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).not.toContain('Modo sin conexión');

    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      value: false,
    });
    window.dispatchEvent(new Event('offline'));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Modo sin conexión');
    expect(fixture.nativeElement.textContent).toContain('La shell instalada sigue disponible');
  });
});

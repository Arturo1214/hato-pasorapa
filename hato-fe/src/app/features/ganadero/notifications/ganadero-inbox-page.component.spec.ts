import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { GanaderoNotificationsStore } from './data-access/ganadero-notifications.store';
import { GanaderoInboxPageComponent } from './ganadero-inbox-page.component';

describe('GanaderoInboxPageComponent', () => {
  let fixture: ComponentFixture<GanaderoInboxPageComponent>;
  const inboxItems = [
    {
      recipientId: 'recipient-1',
      id: 'notification-1',
      title: 'Vacunación pendiente',
      body: 'Coordiná la vacunación del lote A.',
      read: false,
      readAt: null,
      publishedAt: '2026-05-10T10:00:00Z',
    },
    {
      recipientId: 'recipient-2',
      id: 'notification-2',
      title: 'Control completado',
      body: 'El control sanitario fue registrado.',
      read: true,
      readAt: '2026-05-10T12:00:00Z',
      publishedAt: '2026-05-09T10:00:00Z',
    },
  ];
  const store = {
    items: signal(inboxItems),
    loading: signal(false),
    error: signal<string | null>(null),
    unreadCount: signal(1),
    refresh: vi.fn().mockResolvedValue(undefined),
    markAsRead: vi.fn().mockResolvedValue(undefined),
    markAllAsRead: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    store.items.set(inboxItems);
    store.loading.set(false);
    store.error.set(null);
    store.unreadCount.set(1);

    await TestBed.configureTestingModule({
      imports: [GanaderoInboxPageComponent],
      providers: [{ provide: GanaderoNotificationsStore, useValue: store }],
    }).compileComponents();

    fixture = TestBed.createComponent(GanaderoInboxPageComponent);
    fixture.detectChanges();
  });

  it('should render the ganadero inbox with Spanish labels and unread state', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Bandeja de notificaciones');
    expect(text).toContain('1 sin leer');
    expect(text).toContain('Vacunación pendiente');
    expect(text).toContain('No leída');
    expect(text).toContain('Leída');
    expect(text).not.toContain('offline');
  });

  it('should delegate read actions to the server-backed store', () => {
    const markOneButton = fixture.nativeElement.querySelector('[data-testid="mark-one-read"]') as HTMLButtonElement;
    const markAllButton = fixture.nativeElement.querySelector('[data-testid="mark-all-read"]') as HTMLButtonElement;

    markOneButton.click();
    markAllButton.click();

    expect(store.markAsRead).toHaveBeenCalledWith('recipient-1');
    expect(store.markAllAsRead).toHaveBeenCalled();
  });

  it('should show loading, error and empty states in Spanish', () => {
    store.loading.set(true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cargando notificaciones');

    store.loading.set(false);
    store.error.set('No pudimos cargar tus notificaciones. Intentá nuevamente.');
    store.items.set([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar tus notificaciones. Intentá nuevamente.');
    expect(fixture.nativeElement.textContent).toContain('Todavía no recibiste notificaciones.');
  });
});

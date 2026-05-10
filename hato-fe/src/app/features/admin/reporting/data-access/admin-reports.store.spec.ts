import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { AdminReportsService, type HealthActivityResponse } from './admin-reports.service';
import { AdminReportsStore } from './admin-reports.store';

describe('AdminReportsStore', () => {
  let service: {
    getInventoryByGanadero: ReturnType<typeof vi.fn>;
    getHealthActivity: ReturnType<typeof vi.fn>;
    getNotificationReach: ReturnType<typeof vi.fn>;
  };
  let store: AdminReportsStore;

  beforeEach(() => {
    service = {
      getInventoryByGanadero: vi.fn(),
      getHealthActivity: vi.fn(),
      getNotificationReach: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [AdminReportsStore, { provide: AdminReportsService, useValue: service }],
    });

    store = TestBed.inject(AdminReportsStore);
  });

  it('should switch selected report, apply filters, and expose loaded rows without snapshot projections', async () => {
    service.getInventoryByGanadero.mockReturnValue(
      of({ rows: [{ ganaderoId: 42, ganaderoName: 'Don Arturo', total: 5, active: 4, inactive: 1, byCategory: { VACA: 3 }, bySex: { F: 4 } }] })
    );

    store.setFilter({ ganaderoId: 42, active: true });
    await store.loadReport('inventory-by-ganadero');

    expect(store.selectedReport()).toBe('inventory-by-ganadero');
    expect(store.filters()).toEqual(expect.objectContaining({ ganaderoId: 42, active: true }));
    expect(store.reportData()).toEqual([
      { ganaderoId: 42, ganaderoName: 'Don Arturo', total: 5, active: 4, inactive: 1, byCategory: { VACA: 3 }, bySex: { F: 4 } },
    ]);
    expect(service.getInventoryByGanadero).toHaveBeenCalledWith({ ganaderoId: 42, active: true });
  });

  it('should keep loading true while a selected report request is pending', async () => {
    const pending = new Subject<HealthActivityResponse>();
    service.getHealthActivity.mockReturnValue(pending.asObservable());

    const loadingPromise = store.loadReport('health-activity', { from: '2026-05-01', to: '2026-05-10', limit: 25 });

    expect(store.loading()).toBe(true);
    expect(store.error()).toBeNull();

    pending.next({
      rows: [
        {
          eventId: 'event-a',
          occurredAt: '2026-05-09T10:00:00Z',
          type: 'VACCINATION',
          ganaderoId: 7,
          ganaderoName: 'Ganadero A',
          animalUuid: 'animal-a',
          animalCode: 'A-1',
          animalTag: 'TAG-1',
          notes: 'Primera dosis',
        },
      ],
    });
    pending.complete();
    await loadingPromise;

    expect(store.loading()).toBe(false);
    expect(store.reportData()[0]).toEqual(expect.objectContaining({ eventId: 'event-a' }));
  });

  it('should clear rows and expose an error message when the report request fails', async () => {
    service.getNotificationReach.mockReturnValue(throwError(() => new Error('backend down')));

    await store.loadReport('notification-reach', { from: '2026-05-01', to: '2026-05-10' });

    expect(store.selectedReport()).toBe('notification-reach');
    expect(store.loading()).toBe(false);
    expect(store.reportData()).toEqual([]);
    expect(store.error()).toBe('backend down');
  });

  it('should pass targeting mode filters to notification reach requests', async () => {
    service.getNotificationReach.mockReturnValue(of({ rows: [{ title: 'Aviso', totalRecipients: 10, readCount: 8, pendingCount: 2, readRate: 80 }] }));

    await store.loadReport('notification-reach', { from: '2026-05-01', to: '2026-05-10', targetingMode: 'EXPLICIT_LIST' });

    expect(service.getNotificationReach).toHaveBeenCalledWith({ from: '2026-05-01', to: '2026-05-10', targetingMode: 'EXPLICIT_LIST' });
  });
});

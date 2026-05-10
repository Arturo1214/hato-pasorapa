import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { SyncObservabilityComponent } from './sync-observability.component';
import { SyncObservabilityStore } from './data-access/sync-observability.store';

describe('SyncObservabilityComponent', () => {
  let fixture: ComponentFixture<SyncObservabilityComponent>;

  const createStore = (overrides?: { error?: string | null; topReasons?: Array<{ reason: string; count: number; source: 'receipt' | 'conflict_ledger' }>; recentIssues?: Array<{ operationId: string; entityType: string; status: string; reason: string; createdAt: string; source: 'receipt' | 'conflict_ledger'; entityId: string }>; }) => ({
    runtime: signal({
      cycle: {
        trigger: 'manual' as const,
        startedAt: '2026-04-26T10:00:00.000Z',
        finishedAt: '2026-04-26T10:00:05.000Z',
        totalDurationMs: 5000,
        pushDurationMs: 2000,
        pullDurationMs: 3000,
      },
      queue: {
        totalByStatus: { pending: 2, in_flight: 0, retry_scheduled: 0, failed: 1, dead_letter: 0, conflict: 1 },
        byEntity: {} as never,
      },
      errors: [],
      conflicts: { open: 1, resolved: 0, blockedOperations: 1 },
      entityHealth: {
        ANIMAL: { cursorUpdatedAt: '2026-04-26T10:00:00.000Z', lastSuccessAt: '2026-04-26T10:00:00.000Z', stalenessMs: 0, stale: false },
      },
    }),
    historical: signal({
      window: '24h' as const,
      dictionary: [],
      totals: { totalReceipts: 4 },
      byEntity: {},
      topReasons: overrides?.topReasons ?? [{ reason: 'VERSION_CONFLICT', count: 2, source: 'receipt' as const }],
      conflicts: { open: 1, resolved: 2, blockedOperations: 1 },
      entityHealth: {},
      latency: { latestReceiptAt: '2026-04-26T10:00:00.000Z', oldestIssueAt: '2026-04-25T10:00:00.000Z', staleThresholdMs: 86400000 },
      recentIssues: overrides?.recentIssues ?? [
        {
          source: 'receipt' as const,
          operationId: 'op-1',
          entityType: 'ANIMAL',
          entityId: 'animal-1',
          status: 'version_conflict',
          reason: 'VERSION_CONFLICT',
          createdAt: '2026-04-26T10:00:00.000Z',
        },
      ],
    }),
    loading: signal(false),
    error: signal(overrides?.error ?? null),
    selectedWindow: signal('24h' as const),
    allowedWindows: signal(['24h', '7d'] as const),
    recentIssues: signal(overrides?.recentIssues ?? [
      {
        source: 'receipt' as const,
        operationId: 'op-1',
        entityType: 'ANIMAL',
        entityId: 'animal-1',
        status: 'version_conflict',
        reason: 'VERSION_CONFLICT',
        createdAt: '2026-04-26T10:00:00.000Z',
      },
    ]),
    topReasons: signal(overrides?.topReasons ?? [{ reason: 'VERSION_CONFLICT', count: 2, source: 'receipt' as const }]),
    entityHealthEntries: signal([
      ['ANIMAL', { cursorUpdatedAt: '2026-04-26T10:00:00.000Z', lastSuccessAt: '2026-04-26T10:00:00.000Z', stalenessMs: 0, stale: false }],
    ]),
    initialize: vi.fn(async () => undefined),
    useWindow: vi.fn(async () => undefined),
  });

  const configure = async (store = createStore()) => {
    await TestBed.configureTestingModule({
      imports: [SyncObservabilityComponent],
      providers: [{ provide: SyncObservabilityStore, useValue: store }],
    }).compileComponents();

    fixture = TestBed.createComponent(SyncObservabilityComponent);
    fixture.detectChanges();
    return store;
  };

  it('should render runtime and historical observability data', async () => {
    await configure();

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Trigger: manual');
    expect(text).toContain('pending: 2');
    expect(text).toContain('VERSION_CONFLICT · 2');
    expect(text).toContain('ANIMAL · stale=no');
  });

  it('should render empty states without recent issues or reasons', async () => {
    await configure(createStore({ topReasons: [], recentIssues: [] }));

    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Sin razones rankeadas todavía.');
    expect(text).toContain('Sin errores/conflictos recientes.');
  });

  it('should render backend error state', async () => {
    await configure(createStore({ error: 'No pudimos cargar el histórico agregado de sincronización.' }));

    expect(fixture.nativeElement.textContent).toContain('No pudimos cargar el histórico agregado de sincronización.');
  });
});

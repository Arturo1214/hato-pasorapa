import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { AdminReportingStore } from './data-access/admin-reporting.store';
import { AdminReportingPageComponent } from './admin-reporting-page.component';

describe('AdminReportingPageComponent', () => {
  let fixture: ComponentFixture<AdminReportingPageComponent>;
  let fakeStore: ReturnType<typeof createFakeStore>;

  beforeEach(async () => {
    fakeStore = createFakeStore();

    await TestBed.configureTestingModule({
      imports: [AdminReportingPageComponent],
      providers: [{ provide: AdminReportingStore, useValue: fakeStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminReportingPageComponent);
    fixture.detectChanges();
  });

  it('should render freshness, bounded controls and operational recent activity', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Última sync: 2026-04-27T09:59:00.000Z');
    expect(text).toContain('Último cálculo: 2026-04-27T10:00:00.000Z');
    expect(text).toContain('Ventana activa: 7d');
    expect(text).toContain('Preset activo: all');
    expect(text).toContain('Evento sanitario · Vaccination');
    expect(text).toContain('Lotes: 1');
    expect(text).toContain('Costo acumulado: 80');
    expect(text).toContain('V2 descriptivo: sin filtros libres');
  });

  it('should trigger bounded window preset changes and manual refresh from UI actions', async () => {
    await fixture.componentInstance.useWindow('90d');
    await fixture.componentInstance.usePreset('active_only');
    await fixture.componentInstance.refresh();

    expect(fakeStore.setWindow).toHaveBeenCalledWith('90d');
    expect(fakeStore.setPreset).toHaveBeenCalledWith('active_only');
    expect(fakeStore.refreshNow).toHaveBeenCalledTimes(1);
  });

  it('should keep excluded V1 capabilities unavailable in the rendered page', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).not.toContain('Exportar');
    expect(text).not.toContain('Programar reporte');
    expect(text).not.toContain('Predicción');
    expect(text).not.toContain('Filtro libre');
  });
});

function createFakeStore() {
  const freshnessState = signal({
    lastSyncAt: '2026-04-27T09:59:00.000Z',
    lastComputedAt: '2026-04-27T10:00:00.000Z',
    stale: false,
  });
  const summaryState = signal({ usersTotal: 1, ganaderosTotal: 1, animalesTotal: 1, animalesActivos: 1, lotesTotal: 1, lotesActivos: 1, asignacionesActivas: 1, productividadTotal: 1, costosTotal: 1, costoAcumulado: 80 });
  const eventCountsState = signal({ 'ANIMAL_HEALTH_EVENT:VACCINATION': 1 });
  const descriptiveKpisState = signal({ animalesActivos: 1, lotesActivos: 1, productividadTotal: 1, costosTotal: 1, costoAcumulado: 80 });
  const lotBreakdownState = signal([{ lotId: 'lot-a', lotName: 'Lote A', animalesActivos: 1, productividadTotal: 1, costosTotal: 1, costoAcumulado: 80 }]);
  const recentActivityState = signal([
    {
      id: 'health-a',
      sourceType: 'ANIMAL_HEALTH_EVENT',
      eventType: 'VACCINATION',
      occurredAt: '2026-04-27T09:00:00.000Z',
      animalUuid: 'animal-a',
      animalLabel: 'BO-001',
      title: 'Evento sanitario · Vaccination',
    },
  ]);
  const selectedWindowState = signal<'7d' | '30d' | '90d'>('7d');
  const selectedPresetState = signal<'all' | 'active_only' | 'inactive_only'>('all');

  return {
    summary: summaryState.asReadonly(),
    freshness: freshnessState.asReadonly(),
    stale: signal(false).asReadonly(),
    error: signal<string | null>(null).asReadonly(),
    statusMessage: signal<string | null>(null).asReadonly(),
    selectedWindow: selectedWindowState.asReadonly(),
    selectedPreset: selectedPresetState.asReadonly(),
    recentActivity: recentActivityState.asReadonly(),
    descriptiveKpis: descriptiveKpisState.asReadonly(),
    lotBreakdown: lotBreakdownState.asReadonly(),
    allowedWindows: signal(['7d', '30d', '90d'] as const).asReadonly(),
    allowedPresets: signal(['all', 'active_only', 'inactive_only'] as const).asReadonly(),
    scopeGuardMessage: signal('V2 descriptivo: sin filtros libres, exportaciones complejas, reportes programados ni analítica predictiva.').asReadonly(),
    eventCounts: () => eventCountsState(),
    ensureFresh: vi.fn(async () => undefined),
    setWindow: vi.fn(async (window: '7d' | '30d' | '90d') => selectedWindowState.set(window)),
    setPreset: vi.fn(async (preset: 'all' | 'active_only' | 'inactive_only') => selectedPresetState.set(preset)),
    refreshNow: vi.fn(async () => undefined),
  };
}

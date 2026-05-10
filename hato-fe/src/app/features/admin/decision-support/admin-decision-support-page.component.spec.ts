import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AdminDecisionSupportStore } from './data-access/admin-decision-support.store';
import { AdminDecisionSupportPageComponent } from './admin-decision-support-page.component';

describe('AdminDecisionSupportPageComponent', () => {
  let fixture: ComponentFixture<AdminDecisionSupportPageComponent>;
  let fakeStore: ReturnType<typeof createFakeStore>;

  beforeEach(async () => {
    fakeStore = createFakeStore();

    await TestBed.configureTestingModule({
      imports: [AdminDecisionSupportPageComponent],
      providers: [{ provide: AdminDecisionSupportStore, useValue: fakeStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDecisionSupportPageComponent);
    fixture.detectChanges();
  });

  it('should render insight cards with explainability details and offline state', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Costo por encima de la línea base');
    expect(text).toContain('Fuentes: COST_LEDGER, PRODUCTIVITY_LEDGER');
    expect(text).toContain('Ventana: 30d');
    expect(text).toContain('Sin conectividad');
  });

  it('should keep auto-apply blocked and require manual follow-up actions', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Auto-apply bloqueado');
    expect(text).toContain('Decisión manual requerida');
    expect(text).not.toContain('Ejecutar automáticamente');
  });
});

function createFakeStore() {
  return {
    insights: signal([
      {
        id: 'cost-30d',
        category: 'cost',
        window: '30d',
        metric: 'Costo por encima de la línea base',
        currentValue: 180,
        baselineValue: 100,
        deltaPct: 80,
        severity: 'critical',
        why: {
          source: ['COST_LEDGER', 'PRODUCTIVITY_LEDGER'],
          rule: 'Comparación descriptiva periodo contra periodo.',
          generatedAt: '2026-04-27T10:00:00.000Z',
        },
        manualActions: ['Revisar manualmente costos del lote y confirmar decisión manual.'],
        scopeGuard: 'descriptive_only',
      },
    ]).asReadonly(),
    freshness: signal({ lastSyncAt: '2026-04-27T09:59:00.000Z', lastComputedAt: '2026-04-27T10:00:00.000Z', stale: false }).asReadonly(),
    selectedWindow: signal<'7d' | '30d' | '90d'>('30d').asReadonly(),
    loading: signal(false).asReadonly(),
    error: signal<string | null>(null).asReadonly(),
    statusMessage: signal<string | null>('Sin conectividad: mostramos el último estado local persistido.').asReadonly(),
    scopeGuardMessage: signal('Soporte descriptivo solamente: sin forecast, score, optimización ni ejecución automática.').asReadonly(),
    autoApplyMessage: signal('Auto-apply bloqueado · Decisión manual requerida.').asReadonly(),
    allowedWindows: signal(['7d', '30d', '90d'] as const).asReadonly(),
    initialize: vi.fn(async () => undefined),
    ensureFresh: vi.fn(async () => undefined),
    setWindow: vi.fn(async () => undefined),
    refreshNow: vi.fn(async () => undefined),
  };
}

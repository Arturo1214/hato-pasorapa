import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ConflictResolutionPageComponent } from './conflict-resolution-page.component';
import { AdminConflictResolutionStore } from './data-access/admin-conflict-resolution.store';

describe('ConflictResolutionPageComponent', () => {
  let fixture: ComponentFixture<ConflictResolutionPageComponent>;
  let fakeStore: ReturnType<typeof createFakeStore>;

  beforeEach(async () => {
    fakeStore = createFakeStore();

    await TestBed.configureTestingModule({
      imports: [ConflictResolutionPageComponent],
      providers: [{ provide: AdminConflictResolutionStore, useValue: fakeStore }],
    }).compileComponents();

    fixture = TestBed.createComponent(ConflictResolutionPageComponent);
    fixture.detectChanges();
  });

  it('should render diff visual and only policy-allowed actions', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Resolución manual de conflictos');
    expect(text).toContain('tag');
    expect(text).toContain('accept_server');
    expect(text).toContain('retry_local');
    expect(text).not.toContain('discard_local');
  });

  it('should require reason before triggering the manual resolution action', async () => {
    await fixture.componentInstance.resolve('accept_server');
    expect(fakeStore.resolveSelected).not.toHaveBeenCalled();

    fixture.componentInstance.resolutionForm.setValue({ reason: 'Aceptamos el snapshot remoto.' });
    await fixture.componentInstance.resolve('accept_server');
    expect(fakeStore.resolveSelected).toHaveBeenCalledWith('accept_server', 'Aceptamos el snapshot remoto.');
  });
});

function createFakeStore() {
  const items = [
    {
      operationId: 'op-1',
      entityType: 'ANIMAL',
      entityId: 'animal-1',
      opType: 'UPDATE',
      classification: 'version_conflict',
      reason: 'Hay un conflicto remoto.',
      localPayload: { tag: 'BO-3002' },
      clientUpdatedAt: '2026-04-28T10:00:00.000Z',
      serverVersion: 5,
      serverState: { uuid: 'animal-1', tag: 'BO-3001' },
      diffFields: [{ path: 'tag', localValue: 'BO-3002', serverValue: 'BO-3001', severity: 'medium' }],
      policy: {
        entityType: 'ANIMAL',
        opType: 'UPDATE',
        allowedActions: ['accept_server', 'retry_local'],
        uxHint: 'Compará diff campo por campo.',
        policyKey: 'offline-conflict-resolution/v2/ANIMAL/UPDATE',
        policyVersion: 'v2',
      },
      allowedActions: ['accept_server', 'retry_local'],
      auditTrail: [],
    },
  ] as const;

  return {
    items: signal([...items]).asReadonly(),
    loading: signal(false).asReadonly(),
    error: signal<string | null>(null).asReadonly(),
    statusMessage: signal<string | null>(null).asReadonly(),
    unresolvedCount: () => 1,
    selectedOperationId: signal('op-1').asReadonly(),
    selectedConflict: () => items[0],
    initialize: vi.fn(async () => undefined),
    select: vi.fn(),
    refreshNow: vi.fn(async () => undefined),
    resolveSelected: vi.fn(async () => undefined),
  };
}

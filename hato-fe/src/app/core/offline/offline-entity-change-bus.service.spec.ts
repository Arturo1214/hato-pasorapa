import { OfflineEntityChangeBus } from './offline-entity-change-bus.service';

describe('OfflineEntityChangeBus', () => {
  it('watch should emit only matching entity changes', () => {
    const bus = new OfflineEntityChangeBus();
    const observed: string[] = [];

    const subscription = bus.watch(['USER']).subscribe((change) => observed.push(change.entity));
    bus.emit({ entity: 'GANADERO', source: 'pull', operation: 'sync-batch' });
    bus.emit({ entity: 'USER', source: 'pull', operation: 'sync-batch', ids: ['user-1'] });

    expect(observed).toEqual(['USER']);
    expect(bus.lastChange()?.entity).toBe('USER');
    subscription.unsubscribe();
  });

  it('emitBatch should coalesce equivalent changes and de-duplicate ids', () => {
    const bus = new OfflineEntityChangeBus();
    const observed: Array<{ ids?: readonly string[]; count?: number; reason?: string }> = [];

    bus
      .watch(['USER'])
      .subscribe((change) =>
        observed.push({ ids: change.ids, count: change.count, reason: change.reason }),
      );
    bus.emitBatch([
      {
        entity: 'USER',
        source: 'pull',
        operation: 'sync-batch',
        ids: ['user-1'],
        count: 1,
        reason: 'sync',
      },
      {
        entity: 'USER',
        source: 'pull',
        operation: 'sync-batch',
        ids: ['user-1', 'user-2'],
        count: 2,
        reason: 'sync',
      },
      {
        entity: 'USER',
        source: 'pull',
        operation: 'sync-batch',
        ids: ['user-3'],
        count: 1,
        reason: 'other',
      },
    ]);

    expect(observed).toEqual([
      { ids: ['user-1', 'user-2'], count: 3, reason: 'sync' },
      { ids: ['user-3'], count: 1, reason: 'other' },
    ]);
  });
});

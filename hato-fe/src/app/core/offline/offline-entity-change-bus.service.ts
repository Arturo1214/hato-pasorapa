import { Injectable, signal } from '@angular/core';
import { filter, shareReplay, Subject, type Observable } from 'rxjs';
import type { OfflineEntityType } from './offline-types';

export type OfflineEntityChangeKey = OfflineEntityType | 'RAZA' | 'VET_VISIT';

export type OfflineEntityChangeSource =
  | 'local-mutation'
  | 'online-mutation'
  | 'push'
  | 'pull'
  | 'reconcile';

export type OfflineEntityChangeOperation =
  | 'create'
  | 'update'
  | 'delete'
  | 'status-update'
  | 'snapshot-upsert'
  | 'sync-batch';

export interface OfflineEntityChange {
  entity: OfflineEntityChangeKey;
  source: OfflineEntityChangeSource;
  operation: OfflineEntityChangeOperation;
  ids?: readonly string[];
  reason?: string;
  count?: number;
  occurredAt: string;
}

type OfflineEntityChangeInput = Omit<OfflineEntityChange, 'occurredAt'> & { occurredAt?: string };

@Injectable({ providedIn: 'root' })
export class OfflineEntityChangeBus {
  private readonly changesSubject = new Subject<OfflineEntityChange>();
  readonly changes$ = this.changesSubject
    .asObservable()
    .pipe(shareReplay({ bufferSize: 1, refCount: true }));
  readonly lastChange = signal<OfflineEntityChange | null>(null);

  emit(change: OfflineEntityChangeInput) {
    const normalized = {
      ...change,
      occurredAt: change.occurredAt ?? new Date().toISOString(),
    } satisfies OfflineEntityChange;
    this.lastChange.set(normalized);
    this.changesSubject.next(normalized);
  }

  emitBatch(changes: OfflineEntityChangeInput[]) {
    for (const change of coalesceEntityChanges(changes)) {
      this.emit(change);
    }
  }

  watch(entities: readonly OfflineEntityChangeKey[]): Observable<OfflineEntityChange> {
    const allowed = new Set<OfflineEntityChangeKey>(entities);
    return this.changes$.pipe(filter((change) => allowed.has(change.entity)));
  }
}

function coalesceEntityChanges(changes: OfflineEntityChangeInput[]): OfflineEntityChangeInput[] {
  const grouped = new Map<string, OfflineEntityChangeInput>();

  for (const change of changes) {
    const key = [change.entity, change.source, change.operation, change.reason ?? ''].join('|');
    const current = grouped.get(key);

    if (!current) {
      grouped.set(key, { ...change, ids: dedupeIds(change.ids), count: change.count });
      continue;
    }

    grouped.set(key, {
      ...current,
      ids: dedupeIds([...(current.ids ?? []), ...(change.ids ?? [])]),
      count: (current.count ?? 0) + (change.count ?? 0),
      occurredAt: current.occurredAt ?? change.occurredAt,
    });
  }

  return [...grouped.values()].map((change) => ({
    ...change,
    ids: change.ids?.length ? change.ids : undefined,
    count: change.count === undefined ? undefined : change.count,
  }));
}

function dedupeIds(ids: readonly string[] | undefined) {
  return ids ? [...new Set(ids.filter(Boolean))] : undefined;
}

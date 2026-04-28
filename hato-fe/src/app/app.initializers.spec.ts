import { initializeApplicationRuntime, runOfflineRestoreRehydration } from './app.initializers';

describe('initializeApplicationRuntime', () => {
  it('should bootstrap config before initializing the offline sync runtime', async () => {
    const callSequence: string[] = [];
    const syncInitializer = vi.fn(async () => {
      callSequence.push('sync');
    });
    const calendarInitializer = vi.fn(async () => {
      callSequence.push('calendar');
    });
    const calendarRebuild = vi.fn(async () => undefined);
    const notificationsInitializer = vi.fn(async () => {
      callSequence.push('notifications');
    });
    const notificationsRebuild = vi.fn(async () => undefined);
    const conflictsInitializer = vi.fn(async () => {
      callSequence.push('conflicts');
    });
    const conflictsRebuild = vi.fn(async () => undefined);
    const reportingInitializer = vi.fn(async () => {
      callSequence.push('reporting');
    });
    const reportingRebuild = vi.fn(async () => undefined);

    const run = initializeApplicationRuntime(
      {
        bootstrap: () => {
          callSequence.push('config');
        },
      },
      {
        refreshOfflineSession: () => {
          callSequence.push('session');
          return 'active';
        },
      },
      {
        initialize: syncInitializer,
      },
      {
        initialize: calendarInitializer,
        rebuild: calendarRebuild,
      },
      {
        initialize: conflictsInitializer,
        rebuild: conflictsRebuild,
      },
      {
        initialize: notificationsInitializer,
        rebuild: notificationsRebuild,
      },
      {
        initialize: reportingInitializer,
        rebuild: reportingRebuild,
      }
    );

    await run();
    await runOfflineRestoreRehydration();

    expect(callSequence).toEqual(['config', 'session', 'sync', 'calendar', 'conflicts', 'notifications', 'reporting']);
    expect(calendarRebuild).toHaveBeenCalledBefore(notificationsRebuild);
    expect(notificationsRebuild).toHaveBeenCalledBefore(reportingRebuild);
    expect(reportingRebuild).toHaveBeenCalledBefore(conflictsRebuild);
    expect(syncInitializer).toHaveBeenCalledTimes(1);
    expect(calendarInitializer).toHaveBeenCalledTimes(1);
    expect(conflictsInitializer).toHaveBeenCalledTimes(1);
    expect(notificationsInitializer).toHaveBeenCalledTimes(1);
    expect(reportingInitializer).toHaveBeenCalledTimes(1);
  });
});

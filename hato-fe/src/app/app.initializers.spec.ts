import { initializeApplicationRuntime } from './app.initializers';

describe('initializeApplicationRuntime', () => {
  it('should bootstrap config before initializing the offline sync runtime', async () => {
    const callSequence: string[] = [];
    const syncInitializer = vi.fn(async () => {
      callSequence.push('sync');
    });

    const run = initializeApplicationRuntime(
      {
        bootstrap: () => {
          callSequence.push('config');
        },
      },
      {
        initialize: syncInitializer,
      }
    );

    await run();

    expect(callSequence).toEqual(['config', 'sync']);
    expect(syncInitializer).toHaveBeenCalledTimes(1);
  });
});

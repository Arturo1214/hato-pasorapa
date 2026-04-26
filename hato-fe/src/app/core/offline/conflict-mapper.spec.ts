import { HttpErrorResponse } from '@angular/common/http';
import { mapOfflineConflict } from './conflict-mapper';

describe('mapOfflineConflict', () => {
  it('should preserve the manual_refresh hint from offline conflict metadata', () => {
    expect(
      mapOfflineConflict({
        serverVersion: 3,
        reason: 'La versión remota cambió.',
        resolutionHint: 'manual_refresh',
      })
    ).toEqual({
      code: 'VERSION_CONFLICT',
      message: 'La versión remota cambió.',
      resolutionHint: 'manual_refresh',
      manualRefreshRequired: true,
    });
  });

  it('should infer manual_refresh from HTTP 409 version conflicts', () => {
    expect(
      mapOfflineConflict(
        new HttpErrorResponse({
          status: 409,
          error: {
            code: 'VERSION_CONFLICT',
            message: 'La versión remota cambió.',
          },
        })
      )
    ).toEqual({
      code: 'VERSION_CONFLICT',
      message: 'La versión remota cambió.',
      resolutionHint: 'manual_refresh',
      manualRefreshRequired: true,
    });
  });
});

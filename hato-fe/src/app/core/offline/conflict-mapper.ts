import { HttpErrorResponse } from '@angular/common/http';
import { type OfflineConflictMetadata } from './offline-types';

interface ConflictApiError {
  code?: string;
  message?: string;
  resolutionHint?: string;
}

export interface OfflineConflictViewModel {
  code: string;
  message: string;
  resolutionHint?: string;
  manualRefreshRequired: boolean;
}

const DEFAULT_CONFLICT_MESSAGE = 'Hay cambios remotos que requieren revisar y refrescar los datos manualmente.';

export function mapOfflineConflict(
  source: OfflineConflictMetadata | HttpErrorResponse | null | undefined
): OfflineConflictViewModel {
  if (source instanceof HttpErrorResponse) {
    const apiError = (source.error as ConflictApiError | null) ?? {};
    const code = apiError.code ?? (source.status === 409 ? 'VERSION_CONFLICT' : 'UNKNOWN_SYNC_CONFLICT');
    const resolutionHint = apiError.resolutionHint ?? (code === 'VERSION_CONFLICT' ? 'manual_refresh' : undefined);

    return {
      code,
      message: apiError.message ?? DEFAULT_CONFLICT_MESSAGE,
      resolutionHint,
      manualRefreshRequired: resolutionHint === 'manual_refresh',
    };
  }

  if (source) {
    const resolutionHint = source.resolutionHint;

    return {
      code: 'VERSION_CONFLICT',
      message: source.reason || DEFAULT_CONFLICT_MESSAGE,
      resolutionHint,
      manualRefreshRequired: resolutionHint === 'manual_refresh',
    };
  }

  return {
    code: 'UNKNOWN_SYNC_CONFLICT',
    message: DEFAULT_CONFLICT_MESSAGE,
    resolutionHint: undefined,
    manualRefreshRequired: false,
  };
}

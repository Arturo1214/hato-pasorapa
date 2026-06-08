import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, of, type Observable } from 'rxjs';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import { OfflineEntityChangeBus } from '../../../../core/offline/offline-entity-change-bus.service';
import { OfflineStatusService } from '../../../../core/offline/offline-status.service';
import type {
  RazaCreatePayload,
  RazaItem,
  RazaListResponse,
  RazaOption,
  RazaUpdatePayload,
} from '../models/raza.model';

export type {
  RazaCreatePayload,
  RazaItem,
  RazaOption,
  RazaTipo,
  RazaUpdatePayload,
} from '../models/raza.model';

export interface RazaMutationFeedback {
  outcome: 'synced' | 'blocked';
  message: string;
  raza?: RazaItem;
}

@Injectable({ providedIn: 'root' })
export class RazasService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(ApplicationConfigService);
  private readonly authService = inject(AuthService);
  private readonly offlineStatus = inject(OfflineStatusService);
  private readonly entityChangeBus = inject(OfflineEntityChangeBus);

  listAll(): Observable<RazaItem[]> {
    return this.http
      .get<RazaListResponse<RazaItem>>(`${this.appConfig.config().apiBaseUrl}/admin/razas`, {
        headers: this.buildHeaders(),
      })
      .pipe(map((response) => response.items));
  }

  listActiveOptions(): Observable<RazaOption[]> {
    return this.http
      .get<RazaListResponse<RazaOption>>(`${this.appConfig.config().apiBaseUrl}/razas/active`, {
        headers: this.buildHeaders(),
      })
      .pipe(map((response) => response.items));
  }

  create(payload: RazaCreatePayload): Observable<RazaMutationFeedback> {
    if (!this.offlineStatus.isOnline()) {
      return of(this.blockedFeedback());
    }

    return this.http
      .post<RazaItem>(`${this.appConfig.config().apiBaseUrl}/admin/razas`, payload, {
        headers: this.buildMutationHeaders(),
      })
      .pipe(
        map((raza) => {
          this.emitRazaChange(raza.uuid);
          return { outcome: 'synced', message: 'Raza creada correctamente.', raza };
        }),
      );
  }

  update(uuid: string, payload: RazaUpdatePayload): Observable<RazaMutationFeedback> {
    if (!this.offlineStatus.isOnline()) {
      return of(this.blockedFeedback());
    }

    return this.http
      .put<RazaItem>(`${this.appConfig.config().apiBaseUrl}/admin/razas/${uuid}`, payload, {
        headers: this.buildMutationHeaders(),
      })
      .pipe(
        map((raza) => {
          this.emitRazaChange(raza.uuid);
          return { outcome: 'synced', message: 'Raza actualizada correctamente.', raza };
        }),
      );
  }

  setActive(uuid: string, activo: boolean): Observable<RazaMutationFeedback> {
    if (!this.offlineStatus.isOnline()) {
      return of(this.blockedFeedback());
    }

    return this.http
      .patch<RazaItem>(
        `${this.appConfig.config().apiBaseUrl}/admin/razas/${uuid}/active`,
        { activo },
        {
          headers: this.buildMutationHeaders(),
        },
      )
      .pipe(
        map((raza) => {
          this.emitRazaChange(raza.uuid);
          return {
            outcome: 'synced',
            message: activo ? 'Raza activada correctamente.' : 'Raza desactivada correctamente.',
            raza,
          };
        }),
      );
  }

  private blockedFeedback(): RazaMutationFeedback {
    return {
      outcome: 'blocked',
      message: 'La gestión de razas requiere conexión. No se guarda información offline.',
    };
  }

  private emitRazaChange(razaUuid: string) {
    this.entityChangeBus.emit({
      entity: 'RAZA',
      source: 'online-mutation',
      operation: 'snapshot-upsert',
      ids: [razaUuid],
    });
  }

  private buildMutationHeaders() {
    return this.buildHeaders().set('X-Operation-Id', globalThis.crypto.randomUUID());
  }

  private buildHeaders() {
    const token = this.authService.getAccessToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }
}

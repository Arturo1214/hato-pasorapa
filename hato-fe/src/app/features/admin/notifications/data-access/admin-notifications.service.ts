import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';

export type AdminNotificationTargetingMode = 'ALL_ACTIVE_GANADEROS' | 'EXPLICIT_LIST';

export interface AdminNotificationRecord {
  id: string;
  title: string;
  body: string;
  targetingMode: AdminNotificationTargetingMode;
  includeUserIds: string[];
  excludeUserIds: string[];
  recipientCount: number;
  deliveryMetrics: AdminNotificationDeliveryMetrics | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  publishedAt: string;
}

export interface AdminNotificationDeliveryMetrics {
  totalCount: number;
  readCount: number;
  pendingCount: number;
}

export interface AdminNotificationRecipientOption {
  id: string;
  displayName: string;
  username: string;
  email: string;
}

export interface AdminNotificationCreatePayload {
  title: string;
  body: string;
  targetingMode: AdminNotificationTargetingMode;
  includeUserIds: string[];
  excludeUserIds: string[];
}

interface AdminNotificationListResponse {
  notifications: AdminNotificationRecord[];
}

interface ActiveUsersResponse {
  users: Array<{
    id: string;
    username: string;
    email: string;
    displayName: string;
    role: 'ADMIN' | 'GANADERO';
    status: 'ACTIVE' | 'INACTIVE' | 'BLOCKED';
  }>;
}

@Injectable({ providedIn: 'root' })
export class AdminNotificationsService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(ApplicationConfigService);
  private readonly authService = inject(AuthService);

  listHistory(): Observable<AdminNotificationRecord[]> {
    return this.http
      .get<AdminNotificationListResponse>(`${this.appConfig.config().apiBaseUrl}/admin/notifications`, {
        headers: this.buildHeaders(),
      })
      .pipe(map((response) => response.notifications.map((notification) => this.normalizeNotification(notification))));
  }

  createNotification(payload: AdminNotificationCreatePayload): Observable<AdminNotificationRecord> {
    return this.http
      .post<AdminNotificationRecord>(`${this.appConfig.config().apiBaseUrl}/admin/notifications`, payload, {
        headers: this.buildMutationHeaders(),
      })
      .pipe(map((notification) => this.normalizeNotification(notification)));
  }

  listActiveGanaderoRecipients(): Observable<AdminNotificationRecipientOption[]> {
    return this.http
      .get<ActiveUsersResponse>(`${this.appConfig.config().apiBaseUrl}/admin/users?status=ACTIVE`, {
        headers: this.buildHeaders(),
      })
      .pipe(
        map((response) =>
          response.users
            .filter((user) => user.role === 'GANADERO')
            .map((user) => ({
              id: user.id,
              displayName: user.displayName,
              username: user.username,
              email: user.email,
            }))
        )
      );
  }

  private buildMutationHeaders() {
    return this.buildHeaders().set('X-Operation-Id', globalThis.crypto.randomUUID());
  }

  private buildHeaders() {
    const token = this.authService.getAccessToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }

  private normalizeNotification(notification: AdminNotificationRecord): AdminNotificationRecord {
    return {
      ...notification,
      deliveryMetrics: notification.deliveryMetrics ?? null,
    };
  }
}

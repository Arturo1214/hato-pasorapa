import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { map, type Observable } from 'rxjs';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';

export interface GanaderoNotificationInboxItem {
  recipientId: string;
  id: string;
  title: string;
  body: string;
  read: boolean;
  readAt: string | null;
  publishedAt: string;
}

interface GanaderoNotificationInboxResponse {
  notifications: GanaderoNotificationInboxItem[];
}

interface GanaderoUnreadCountResponse {
  unreadCount: number;
}

@Injectable({ providedIn: 'root' })
export class GanaderoNotificationsService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(ApplicationConfigService);
  private readonly authService = inject(AuthService);

  getInbox(): Observable<GanaderoNotificationInboxItem[]> {
    return this.http
      .get<GanaderoNotificationInboxResponse>(`${this.baseUrl()}/inbox`, {
        headers: this.buildHeaders(),
      })
      .pipe(map((response) => response.notifications));
  }

  getUnreadCount(): Observable<number> {
    return this.http
      .get<GanaderoUnreadCountResponse>(`${this.baseUrl()}/unread-count`, {
        headers: this.buildHeaders(),
      })
      .pipe(map((response) => response.unreadCount));
  }

  markAsRead(recipientId: string): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl()}/recipients/${recipientId}/read`, {}, {
      headers: this.buildMutationHeaders(),
    });
  }

  markAllAsRead(): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl()}/recipients/read`, {}, {
      headers: this.buildMutationHeaders(),
    });
  }

  private baseUrl() {
    return `${this.appConfig.config().apiBaseUrl}/notifications`;
  }

  private buildMutationHeaders() {
    return this.buildHeaders().set('X-Operation-Id', globalThis.crypto.randomUUID());
  }

  private buildHeaders() {
    const token = this.authService.getAccessToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }
}

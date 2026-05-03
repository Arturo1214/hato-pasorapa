import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';

export interface DashboardCategorySummary {
  vaquillas: number;
  vacas: number;
  toros: number;
  terneros: number;
  bueyes: number;
}

export interface AnimalsSummary {
  machos: DashboardCategorySummary;
  hembras: DashboardCategorySummary;
}

export interface UpcomingEvent {
  id: string;
  eventType: string;
  eventDate: string;
  description: string;
}

export interface UnreadCountResponse {
  count: number;
}

export interface UpcomingVisit {
  id: string;
  controlType: string;
  plannedDate: string;
  status: string;
}

@Injectable({ providedIn: 'root' })
export class GanaderoDashboardService {
  private readonly http = inject(HttpClient);
  private readonly appConfig = inject(ApplicationConfigService);
  private readonly authService = inject(AuthService);

  readonly animalsSummary = signal<AnimalsSummary | null>(null);
  readonly upcomingEvents = signal<UpcomingEvent[]>([]);
  readonly unreadCount = signal(0);
  readonly upcomingVisits = signal<UpcomingVisit[]>([]);

  loadDashboard() {
    forkJoin({
      animalsSummary: this.http.get<AnimalsSummary>(`${this.baseUrl()}/animals-summary`, { headers: this.buildHeaders() }),
      upcomingEvents: this.http.get<UpcomingEvent[]>(`${this.baseUrl()}/upcoming-events?limit=5`, { headers: this.buildHeaders() }),
      unreadCount: this.http.get<UnreadCountResponse>(`${this.baseUrl()}/unread-count`, { headers: this.buildHeaders() }),
      upcomingVisits: this.http.get<UpcomingVisit[]>(`${this.baseUrl()}/upcoming-visits?limit=5`, { headers: this.buildHeaders() }),
    }).subscribe(({ animalsSummary, upcomingEvents, unreadCount, upcomingVisits }) => {
      this.animalsSummary.set(animalsSummary);
      this.upcomingEvents.set(upcomingEvents);
      this.unreadCount.set(unreadCount.count);
      this.upcomingVisits.set(upcomingVisits);
    });
  }

  private baseUrl() {
    return `${this.appConfig.config().apiBaseUrl}/ganadero/dashboard`;
  }

  private buildHeaders() {
    const token = this.authService.getAccessToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }
}

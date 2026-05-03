import { HttpClient, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { AuthService, type Role } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';

export interface ProfileUpdatePayload {
  telefono: string;
  direccion: string;
}

export interface ProfileResponse {
  telefono: string;
  direccion: string;
  role: Role;
}

export interface ProfilePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

export interface ProfileActionResponse {
  message: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly authService = inject(AuthService);
  private readonly appConfig = inject(ApplicationConfigService);

  updateProfile(payload: ProfileUpdatePayload) {
    return this.http.put<ProfileResponse>(`${this.appConfig.config().apiBaseUrl}/admin/profile`, payload, {
      headers: this.buildHeaders(),
    });
  }

  updatePassword(payload: ProfilePasswordPayload) {
    return this.http.put<ProfileActionResponse>(
      `${this.appConfig.config().apiBaseUrl}/admin/profile/password`,
      payload,
      {
        headers: this.buildHeaders(),
      }
    );
  }

  private buildHeaders() {
    const token = this.authService.getAccessToken();
    return token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : new HttpHeaders();
  }
}

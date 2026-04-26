import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { OfflineStatusService } from './offline-status.service';

@Component({
  selector: 'app-offline-banner',
  standalone: true,
  imports: [CommonModule],
  template: `
    @if (offlineStatus.message(); as message) {
      <section class="offline-banner" role="status" aria-live="polite">
        <strong>Modo sin conexión</strong>
        <p>{{ message }}</p>
      </section>
    }
  `,
  styles: [
    `
      .offline-banner {
        margin: 16px 24px 0;
        padding: 12px 16px;
        border: 1px solid #f59e0b;
        border-radius: 12px;
        background: #fffbeb;
        color: #92400e;
      }

      .offline-banner p {
        margin: 4px 0 0;
      }
    `,
  ],
})
export class OfflineBannerComponent {
  readonly offlineStatus = inject(OfflineStatusService);
}

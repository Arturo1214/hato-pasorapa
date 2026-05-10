import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { ApplicationConfigService } from '../../../core/config/application-config.service';
import { OfflineBackupService } from '../../../core/offline/backup/offline-backup.service';
import { BackupImportError, BackupValidationError } from '../../../core/offline/backup/offline-backup.types';

@Component({
  selector: 'app-backup-page',
  standalone: true,
  imports: [CommonModule, MatButtonModule, MatCardModule],
  template: `
    <section class="backup-page">
      @if (!enabled()) {
        <mat-card appearance="outlined">
          <p>La feature flag offlineBackupV1Enabled está desactivada para este runtime.</p>
        </mat-card>
      } @else {
        <mat-card appearance="outlined">
          <h2>Exportar</h2>
          <p>Podés bajar un JSON completo o una variante sin binarios ANIMAL_IMAGE.</p>
          <div class="actions">
            <button mat-flat-button color="primary" type="button" (click)="exportWithImages()" [disabled]="busy()">
              Exportar con imágenes
            </button>
            <button mat-stroked-button type="button" (click)="exportWithoutImages()" [disabled]="busy()">
              Exportar sin imágenes
            </button>
          </div>
        </mat-card>

        <mat-card appearance="outlined">
          <h2>Importar / restore</h2>
          <p>La restauración reemplaza los stores locales, rehidrata runtime y fuerza reautenticación antes del próximo sync.</p>
          <input type="file" accept="application/json,.json" (change)="onFileSelected($event)" />
        </mat-card>
      }

      @if (feedbackMessage()) {
        <mat-card appearance="outlined"><p>{{ feedbackMessage() }}</p></mat-card>
      }

      @if (errorMessage()) {
        <mat-card appearance="outlined"><p>{{ errorMessage() }}</p></mat-card>
      }
    </section>
  `,
  styles: [
    `
      .backup-page {
        display: grid;
        gap: 1rem;
        padding: 1rem;
      }

      .actions {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;
      }
    `,
  ],
})
export class BackupPageComponent {
  private readonly appConfig = inject(ApplicationConfigService);
  private readonly backupService = inject(OfflineBackupService);

  readonly busy = signal(false);
  readonly feedbackMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly enabled = computed(() => this.appConfig.config().offlineBackupV1Enabled === true);

  async exportWithImages() {
    await this.exportBackup(true);
  }

  async exportWithoutImages() {
    await this.exportBackup(false);
  }

  async onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement | null)?.files?.item(0);
    if (!file) {
      return;
    }

    this.busy.set(true);
    this.feedbackMessage.set(null);
    this.errorMessage.set(null);

    try {
      const result = await this.backupService.importBackupFile(file);
      this.feedbackMessage.set(
        `Restore completado. ${result.imagesRestored} imagen(es) restauradas y reautenticación requerida antes del próximo sync.`
      );
    } catch (error) {
      this.errorMessage.set(resolveBackupErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  private async exportBackup(includeImages: boolean) {
    this.busy.set(true);
    this.feedbackMessage.set(null);
    this.errorMessage.set(null);

    try {
      await this.backupService.downloadBackup({ includeImages });
      this.feedbackMessage.set(
        includeImages
          ? 'Backup completo exportado con digest SHA-256 verificable.'
          : 'Backup exportado sin binarios ANIMAL_IMAGE.'
      );
    } catch (error) {
      this.errorMessage.set(resolveBackupErrorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}

function resolveBackupErrorMessage(error: unknown) {
  if (error instanceof BackupValidationError) {
    return error.issues[0]?.message ?? error.message;
  }

  if (error instanceof BackupImportError) {
    return error.message;
  }

  return 'No pudimos completar la operación de backup local.';
}

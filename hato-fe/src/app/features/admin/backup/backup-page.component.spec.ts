import { ComponentFixture, TestBed } from '@angular/core/testing';
import { BackupPageComponent } from './backup-page.component';
import { ApplicationConfigService } from '../../../core/config/application-config.service';
import { OfflineBackupService } from '../../../core/offline/backup/offline-backup.service';

describe('BackupPageComponent', () => {
  let fixture: ComponentFixture<BackupPageComponent>;
  let fakeBackupService: ReturnType<typeof createFakeBackupService>;

  beforeEach(async () => {
    fakeBackupService = createFakeBackupService();

    await TestBed.configureTestingModule({
      imports: [BackupPageComponent],
      providers: [
        { provide: OfflineBackupService, useValue: fakeBackupService },
        {
          provide: ApplicationConfigService,
          useValue: {
            config: () => ({ apiBaseUrl: '/api', offlineConflictResolutionV2: true, offlineBackupV1Enabled: true }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BackupPageComponent);
    fixture.detectChanges();
  });

  it('should trigger local export actions for full and no-image backups', async () => {
    await fixture.componentInstance.exportWithImages();
    await fixture.componentInstance.exportWithoutImages();

    expect(fakeBackupService.downloadBackup).toHaveBeenCalledWith({ includeImages: true });
    expect(fakeBackupService.downloadBackup).toHaveBeenCalledWith({ includeImages: false });
  });

  it('should import a selected backup file and show restore feedback', async () => {
    const file = new File(['{"ok":true}'], 'backup.json', { type: 'application/json' });

    await fixture.componentInstance.onFileSelected({
      target: { files: { item: () => file } },
    } as unknown as Event);
    fixture.detectChanges();

    expect(fakeBackupService.importBackupFile).toHaveBeenCalledWith(file);
    expect(fixture.nativeElement.textContent).toContain('reautenticación requerida');
  });
});

function createFakeBackupService() {
  return {
    downloadBackup: vi.fn(async () => undefined),
    importBackupFile: vi.fn(async () => ({
      restoredAt: '2026-04-28T14:00:00.000Z',
      imagesRestored: 1,
      entityCounts: { OUTBOX: 0 },
    })),
  };
}

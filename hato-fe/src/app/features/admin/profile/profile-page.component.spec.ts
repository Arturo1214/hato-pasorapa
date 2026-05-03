import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthService } from '../../../core/auth/data-access/auth.service';
import { ProfilePageComponent } from './profile-page.component';
import { ProfileService } from './data-access/profile.service';

describe('ProfilePageComponent', () => {
  const createProfileServiceMock = () => ({
    updateProfile: vi.fn(() => of({ telefono: '70000001', direccion: 'Calle 1', role: 'GANADERO' as const })),
    updatePassword: vi.fn(() => of({ message: 'Contraseña actualizada correctamente.' })),
  });

  const configure = async (serviceMock: ReturnType<typeof createProfileServiceMock>) => {
    await TestBed.configureTestingModule({
      imports: [ProfilePageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ProfileService,
          useValue: serviceMock,
        },
        {
          provide: AuthService,
          useValue: {
            currentUser: signal({
              id: 'ganadero-1',
              username: 'campo@hato.bo',
              email: 'campo@hato.bo',
              displayName: 'Campo Base',
              role: 'GANADERO' as const,
              status: 'ACTIVE' as const,
              version: 1,
              updatedAt: '2026-05-02T10:00:00.000Z',
              lastSyncedAt: null,
            }),
          },
        },
      ],
    }).compileComponents();

    const fixture = TestBed.createComponent(ProfilePageComponent);
    fixture.detectChanges();
    return { fixture, component: fixture.componentInstance };
  };

  it('should submit ganadero contact data when the profile form is valid', async () => {
    const serviceMock = createProfileServiceMock();
    const { component } = await configure(serviceMock);

    component.profileForm.setValue({ telefono: '70000001', direccion: 'Calle 1' });
    component.submitProfile();

    expect(serviceMock.updateProfile).toHaveBeenCalledWith({ telefono: '70000001', direccion: 'Calle 1' });
  });

  it('should block password changes until confirmation matches and the current password is present', async () => {
    const serviceMock = createProfileServiceMock();
    const { fixture, component } = await configure(serviceMock);

    component.passwordForm.setValue({
      currentPassword: '',
      newPassword: 'NuevaClave9',
      confirmPassword: 'OtraClave9',
    });
    component.submitPassword();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ingresá tu contraseña actual.');
    expect(fixture.nativeElement.textContent).toContain('Las contraseñas no coinciden.');
    expect(serviceMock.updatePassword).not.toHaveBeenCalled();
  });

  it('should show the backend error when the current password is incorrect', async () => {
    const serviceMock = createProfileServiceMock();
    serviceMock.updatePassword.mockReturnValue(
      throwError(() => ({ error: { code: 'CURRENT_PASSWORD_INVALID', message: 'Contraseña actual incorrecta' } }))
    );
    const { fixture, component } = await configure(serviceMock);

    component.passwordForm.setValue({
      currentPassword: 'Incorrecta9',
      newPassword: 'NuevaClave9',
      confirmPassword: 'NuevaClave9',
    });
    component.submitPassword();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Contraseña actual incorrecta');
  });
});

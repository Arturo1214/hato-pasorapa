import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { BootstrapPageComponent } from './bootstrap-page.component';

describe('BootstrapPageComponent', () => {
  let fixture: ComponentFixture<BootstrapPageComponent>;
  let component: BootstrapPageComponent;
  const loading = signal(false);
  const bootstrap = vi.fn(() =>
    of({
      success: false,
      error: {
        code: 'PASSWORD_POLICY_VIOLATION',
        message: 'La contraseña debe tener al menos 8 caracteres, 1 mayúscula y 1 número.',
      },
    })
  );

  const installStorageMock = () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      },
    });
  };

  beforeEach(async () => {
    installStorageMock();

    await TestBed.configureTestingModule({
      imports: [BootstrapPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: ApplicationConfigService,
          useValue: { config: () => ({ apiBaseUrl: '/api' }) },
        },
        {
          provide: AuthService,
          useValue: {
            loading,
            bootstrap,
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(BootstrapPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should mark all required fields with explicit messages', () => {
    component.submit();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ingresá un usuario administrador.');
    expect(fixture.nativeElement.textContent).toContain('Ingresá un correo válido.');
    expect(fixture.nativeElement.textContent).toContain('Ingresá un nombre visible para el administrador.');
  });

  it('should validate the password policy before calling bootstrap', () => {
    component.form.setValue({
      username: 'root-admin',
      email: 'root-admin@hato.bo',
      displayName: 'Root Admin',
      password: 'weakpass',
    });

    component.submit();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'La contraseña debe tener al menos 8 caracteres, 1 mayúscula y 1 número.'
    );
    expect(bootstrap).not.toHaveBeenCalled();
  });

  it('should expose the shared password policy copy in the bootstrap form', () => {
    expect(component.passwordPolicyMessage).toBe(
      'La contraseña debe tener al menos 8 caracteres, 1 mayúscula y 1 número.'
    );
    expect(fixture.nativeElement.textContent).toContain(component.passwordPolicyMessage);
  });

  it('should show password policy guidance when backend rejects bootstrap', () => {
    component.form.setValue({
      username: 'root-admin',
      email: 'root-admin@hato.bo',
      displayName: 'Root Admin',
      password: 'weakpass',
    });

    component.submit();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'La contraseña debe tener al menos 8 caracteres, 1 mayúscula y 1 número.'
    );
  });

  it('should disable the submit button while bootstrap is loading', () => {
    loading.set(true);
    fixture.detectChanges();

    const submitButton = fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement;

    expect(submitButton.disabled).toBe(true);
    expect(submitButton.textContent).toContain('Creando…');
  });
});

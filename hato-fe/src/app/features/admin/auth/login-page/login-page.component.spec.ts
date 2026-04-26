import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { LoginPageComponent } from './login-page.component';

describe('LoginPageComponent', () => {
  let fixture: ComponentFixture<LoginPageComponent>;
  let component: LoginPageComponent;

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
      imports: [LoginPageComponent],
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
            loading: () => false,
            login: () => of({ success: false, error: { code: 'INVALID_CREDENTIALS', message: 'Usuario o contraseña inválidos.' } }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should show required messages when submitting an empty controlled form', () => {
    component.submit();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ingresá tu usuario o correo.');
    expect(fixture.nativeElement.textContent).toContain('Ingresá tu contraseña.');
  });

  it('should show a clear backend message when credentials are invalid', () => {
    component.form.setValue({ username: 'admin', password: 'wrong' });
    component.submit();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Usuario o contraseña inválidos.');
  });

  it('should explain that the hardened login only works with ADMIN and GANADERO roles', () => {
    expect(component.allowedRolesMessage).toBe('Solo existen roles ADMIN y GANADERO.');
    expect(fixture.nativeElement.textContent).toContain(component.allowedRolesMessage);
  });
});

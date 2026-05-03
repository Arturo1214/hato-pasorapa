import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap, provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { LoginPageComponent } from './login-page.component';

describe('LoginPageComponent', () => {
  let fixture: ComponentFixture<LoginPageComponent>;
  let component: LoginPageComponent;
  let router: Router;

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
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({}),
            },
            queryParamMap: of(convertToParamMap({})),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginPageComponent);
    component = fixture.componentInstance;
    router = TestBed.inject(Router);
    vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fixture.detectChanges();
  });

  it('should show required messages when submitting an empty controlled form', () => {
    component.submit();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ingresá tu correo o CI.');
    expect(fixture.nativeElement.textContent).toContain('Ingresá tu contraseña.');
  });

  it('should show a clear backend message when credentials are invalid', () => {
    component.form.setValue({ username: 'admin', password: 'wrong' });
    component.submit();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Usuario o contraseña inválidos.');
  });

  it('should render user-facing branding copy without bootstrap or role instructions', () => {
    const text = fixture.nativeElement.textContent;
    const registerLink = fixture.nativeElement.querySelector('a[routerLink="/registro"]') as HTMLAnchorElement | null;

    expect(text).toContain('Pasorapa Hato');
    expect(text).toContain('Registrate como ganadero.');
    expect(text).toContain('correo o CI');
    expect(text).not.toContain('Solo existen roles ADMIN y GANADERO.');
    expect(text).not.toContain('bootstrap inicial');
    expect(registerLink).not.toBeNull();
  });

  it('should render differentiated copy for expired and reauth_required session states', async () => {
    await TestBed.resetTestingModule();
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
            login: () => of({ success: true, error: null }),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({ session: 'expired', returnUrl: '/admin/dashboard' }),
            },
            queryParamMap: of(convertToParamMap({ session: 'expired', returnUrl: '/admin/dashboard' })),
          },
        },
      ],
    }).compileComponents();

    const expiredFixture = TestBed.createComponent(LoginPageComponent);
    expiredFixture.detectChanges();
    expect(expiredFixture.nativeElement.textContent).toContain('Tu sesión offline expiró.');

    await TestBed.resetTestingModule();
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
            login: () => of({ success: true, error: null }),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({ session: 'reauth_required', returnUrl: '/admin/animales' }),
            },
            queryParamMap: of(convertToParamMap({ session: 'reauth_required', returnUrl: '/admin/animales' })),
          },
        },
      ],
    }).compileComponents();

    const reauthFixture = TestBed.createComponent(LoginPageComponent);
    reauthFixture.detectChanges();
    expect(reauthFixture.nativeElement.textContent).toContain('requiere reautenticación');
  });

  it('should return to the protected flow after a successful reauthentication login', async () => {
    await TestBed.resetTestingModule();
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
            login: () => of({ success: true, error: null }),
          },
        },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              queryParamMap: convertToParamMap({ session: 'reauth_required', returnUrl: '/admin/dashboard' }),
            },
            queryParamMap: of(convertToParamMap({ session: 'reauth_required', returnUrl: '/admin/dashboard' })),
          },
        },
      ],
    }).compileComponents();

    const successFixture = TestBed.createComponent(LoginPageComponent);
    const successRouter = TestBed.inject(Router);
    const navigateByUrlSpy = vi.spyOn(successRouter, 'navigateByUrl').mockResolvedValue(true);

    successFixture.componentInstance.form.setValue({ username: 'admin', password: 'Admin123' });
    successFixture.componentInstance.submit();

    expect(navigateByUrlSpy).toHaveBeenCalledWith('/admin/dashboard');
  });
});

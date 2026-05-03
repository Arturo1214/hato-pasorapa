import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { AuthService } from '../../../core/auth/data-access/auth.service';
import { GanaderoRegistrationPageComponent } from './ganadero-registration-page.component';

describe('GanaderoRegistrationPageComponent', () => {
  let fixture: ComponentFixture<GanaderoRegistrationPageComponent>;
  const authServiceMock = {
    loading: () => false,
    registerGanadero: vi.fn(() => of({ success: true, error: null })),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GanaderoRegistrationPageComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        {
          provide: AuthService,
          useValue: authServiceMock,
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(GanaderoRegistrationPageComponent);
    fixture.detectChanges();
  });

  it('should present registration as ganadero onboarding without admin or bootstrap language', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Registro de ganaderos');
    expect(text).toContain('Pasorapa Hato');
    expect(text).not.toContain('administrador');
    expect(text).not.toContain('bootstrap');
  });

  it('should require all visible registration fields before submit', () => {
    fixture.componentInstance.submit();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Ingresá tu CI o identificador.');
    expect(fixture.nativeElement.textContent).toContain('Ingresá tu nombre completo.');
    expect(fixture.nativeElement.textContent).toContain('Ingresá un correo válido.');
    expect(fixture.nativeElement.textContent).toContain('Confirmá la contraseña.');
  });

  it('should render a hidden honeypot field outside the normal tab flow', () => {
    const honeypot = fixture.nativeElement.querySelector('input[formControlName="website"]') as HTMLInputElement;

    expect(honeypot).not.toBeNull();
    expect(honeypot.getAttribute('tabindex')).toBe('-1');
    expect(honeypot.getAttribute('autocomplete')).toBe('off');
  });

  it('should submit the anti-spam payload and delegate registration through auth service', () => {
    const component = fixture.componentInstance;
    component.form.controls.formIssuedAt.setValue('2026-05-02T22:59:55.000Z');
    component.form.setValue({
      businessIdentifier: '12345678',
      name: 'Ganadera Norte',
      email: 'ganadera@hato.bo',
      password: 'Ganadera9',
      confirmPassword: 'Ganadera9',
      website: '',
      formIssuedAt: '2026-05-02T22:59:55.000Z',
    });

    component.submit();

    expect(authServiceMock.registerGanadero).toHaveBeenCalledWith({
      businessIdentifier: '12345678',
      name: 'Ganadera Norte',
      email: 'ganadera@hato.bo',
      password: 'Ganadera9',
      website: '',
      formIssuedAt: '2026-05-02T22:59:55.000Z',
    });
  });
});

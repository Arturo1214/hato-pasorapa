import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { SidebarComponent } from './sidebar';

describe('SidebarComponent', () => {
  let fixture: ComponentFixture<SidebarComponent>;

  beforeEach(async () => {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
      },
    });

    await TestBed.configureTestingModule({
      imports: [SidebarComponent],
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
            currentUser: () => ({ role: 'ADMIN' }),
          },
        },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(SidebarComponent);
    fixture.detectChanges();
  });

  it('should show admin navigation entries for administrative management', () => {
    const text = fixture.nativeElement.textContent;

    expect(text).toContain('Dashboard');
    expect(text).toContain('Usuarios');
    expect(text).toContain('Ganaderos');
  });
});

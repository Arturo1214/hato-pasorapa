import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AuthService } from '../data-access/auth.service';
import { roleRedirectGuard } from './role-redirect.guard';

describe('roleRedirectGuard', () => {
  const routerMock = {
    createUrlTree: vi.fn((commands: string[]) => commands.join('/')),
  };

  beforeEach(() => {
    routerMock.createUrlTree.mockClear();
  });

  it('should redirect ADMIN to /admin/dashboard', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            currentUser: () => ({ role: 'ADMIN' }),
          },
        },
        { provide: Router, useValue: routerMock },
      ],
    });

    const result = TestBed.runInInjectionContext(() => roleRedirectGuard({} as never, {} as never));

    expect(result).toBe('/admin/dashboard');
    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/admin/dashboard']);
  });

  it('should redirect GANADERO to /ganadero/dashboard', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            currentUser: () => ({ role: 'GANADERO' }),
          },
        },
        { provide: Router, useValue: routerMock },
      ],
    });

    const result = TestBed.runInInjectionContext(() => roleRedirectGuard({} as never, {} as never));

    expect(result).toBe('/ganadero/dashboard');
    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/ganadero/dashboard']);
  });

  it('should redirect unknown role to /admin/dashboard', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            currentUser: () => null,
          },
        },
        { provide: Router, useValue: routerMock },
      ],
    });

    const result = TestBed.runInInjectionContext(() => roleRedirectGuard({} as never, {} as never));

    expect(result).toBe('/admin/dashboard');
    expect(routerMock.createUrlTree).toHaveBeenCalledWith(['/admin/dashboard']);
  });
});

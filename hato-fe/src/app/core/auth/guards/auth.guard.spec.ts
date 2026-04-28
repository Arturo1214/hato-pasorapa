import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { authGuard, guestGuard } from './auth.guard';
import { AuthService } from '../data-access/auth.service';

describe('authGuard', () => {
  it('should allow authenticated users with active status', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: () => true,
            getOfflineSessionStatus: () => 'active',
            currentUser: () => ({ status: 'ACTIVE' }),
          },
        },
        {
          provide: Router,
          useValue: {
            createUrlTree: (commands: string[], extras?: { queryParams?: Record<string, string> }) => ({ commands, extras }),
          },
        },
      ],
    });

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect(result).toBe(true);
  });

  it('should redirect blocked or anonymous users to login', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: () => true,
            getOfflineSessionStatus: () => 'expired',
            currentUser: () => ({ status: 'BLOCKED' }),
          },
        },
        {
          provide: Router,
          useValue: {
            createUrlTree: (commands: string[], extras?: { queryParams?: Record<string, string> }) => ({ commands, extras }),
          },
        },
      ],
    });

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, { url: '/admin/dashboard' } as never));
    expect(result).toEqual({
      commands: ['/login'],
      extras: {
        queryParams: {
          session: 'expired',
          returnUrl: '/admin/dashboard',
        },
      },
    });
  });
});

describe('guestGuard', () => {
  it('should redirect authenticated users away from guest pages', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            isAuthenticated: () => true,
          },
        },
        {
          provide: Router,
          useValue: {
            createUrlTree: (commands: string[]) => commands.join('/'),
          },
        },
      ],
    });

    const result = TestBed.runInInjectionContext(() => guestGuard({} as never, {} as never));
    expect(result).toBe('/');
  });
});

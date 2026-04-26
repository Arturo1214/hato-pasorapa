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
            currentUser: () => ({ status: 'ACTIVE' }),
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
            currentUser: () => ({ status: 'BLOCKED' }),
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

    const result = TestBed.runInInjectionContext(() => authGuard({} as never, {} as never));
    expect(result).toBe('/login');
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

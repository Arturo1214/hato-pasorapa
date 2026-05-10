import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { roleGuard } from './role.guard';
import { AuthService } from '../data-access/auth.service';

describe('roleGuard', () => {
  it('should allow ADMIN routes when current session role matches', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            currentUser: () => ({ role: 'ADMIN', status: 'ACTIVE' }),
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

    const result = TestBed.runInInjectionContext(() =>
      roleGuard(['ADMIN'])({ data: { roles: ['ADMIN'] } } as never, {} as never)
    );

    expect(result).toBe(true);
  });

  it('should redirect active users without a matching role to forbidden page', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            currentUser: () => ({ role: 'GANADERO', status: 'ACTIVE' }),
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

    const result = TestBed.runInInjectionContext(() =>
      roleGuard(['ADMIN'])({ data: { roles: ['ADMIN'] } } as never, {} as never)
    );

    expect(result).toBe('/403');
  });

  it('should redirect unauthenticated or inactive users to login', () => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: AuthService,
          useValue: {
            currentUser: () => null,
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

    const result = TestBed.runInInjectionContext(() =>
      roleGuard(['ADMIN'])({ data: { roles: ['ADMIN'] } } as never, {} as never)
    );

    expect(result).toBe('/login');
  });
});

import { HttpClient, HttpHeaders } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom, of } from 'rxjs';
import { AuthService } from '../../../../core/auth/data-access/auth.service';
import { ApplicationConfigService } from '../../../../core/config/application-config.service';
import { OfflineEntityChangeBus } from '../../../../core/offline/offline-entity-change-bus.service';
import { OfflineStatusService } from '../../../../core/offline/offline-status.service';
import { RazasService, type RazaItem } from './razas.service';

describe('RazasService', () => {
  const createRaza = (overrides: Partial<RazaItem> = {}): RazaItem => ({
    uuid: 'raza-1',
    nombre: 'Criolla',
    descripcion: 'Adaptada al monte chaqueño.',
    origen: 'Bolivia',
    tipo: 'UNCLASSIFIED',
    activo: true,
    sortOrder: 1,
    version: 1,
    createdAt: '2026-05-10T10:00:00',
    updatedAt: '2026-05-10T10:00:00',
    ...overrides,
  });

  const setup = (options: {
    online: boolean;
    http?: Partial<Pick<HttpClient, 'get' | 'post' | 'put' | 'patch'>>;
  }) => {
    const entityChangeBus = new OfflineEntityChangeBus();
    TestBed.configureTestingModule({
      providers: [
        RazasService,
        {
          provide: HttpClient,
          useValue: {
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            patch: vi.fn(),
            ...options.http,
          },
        },
        { provide: ApplicationConfigService, useValue: { config: () => ({ apiBaseUrl: '/api' }) } },
        { provide: AuthService, useValue: { getAccessToken: () => 'token' } },
        { provide: OfflineStatusService, useValue: { isOnline: () => options.online } },
        { provide: OfflineEntityChangeBus, useValue: entityChangeBus },
      ],
    });

    return { service: TestBed.inject(RazasService), entityChangeBus };
  };

  afterEach(() => TestBed.resetTestingModule());

  it('should list all admin razas from the backend wrapper response with auth headers', async () => {
    const get = vi.fn(() => of({ items: [createRaza()] }));
    const { service } = setup({ online: true, http: { get: get as never } });

    await expect(firstValueFrom(service.listAll())).resolves.toEqual([createRaza()]);

    expect(get).toHaveBeenCalledWith('/api/admin/razas', {
      headers: expect.any(HttpHeaders),
    });
    expect((get.mock.calls[0] as any[])[1].headers.get('Authorization')).toBe('Bearer token');
  });

  it('should use the active endpoint for selector options', async () => {
    const get = vi.fn(() =>
      of({ items: [createRaza({ uuid: 'raza-2', nombre: 'Brangus', sortOrder: 2 })] }),
    );
    const { service } = setup({ online: true, http: { get: get as never } });

    await expect(firstValueFrom(service.listActiveOptions())).resolves.toEqual([
      expect.objectContaining({ uuid: 'raza-2', nombre: 'Brangus', sortOrder: 2 }),
    ]);

    expect(get).toHaveBeenCalledWith('/api/razas/active', { headers: expect.any(HttpHeaders) });
  });

  it('should block create/update/activation when admin is offline', async () => {
    const post = vi.fn();
    const put = vi.fn();
    const patch = vi.fn();
    const { service } = setup({
      online: false,
      http: { post: post as never, put: put as never, patch: patch as never },
    });

    await expect(
      firstValueFrom(
        service.create({
          nombre: 'Brangus',
          descripcion: '',
          origen: '',
          sortOrder: 2,
          tipo: 'UNCLASSIFIED',
        }),
      ),
    ).resolves.toEqual({
      outcome: 'blocked',
      message: 'La gestión de razas requiere conexión. No se guarda información offline.',
    });
    await expect(
      firstValueFrom(
        service.update('raza-1', {
          nombre: 'Criolla',
          descripcion: '',
          origen: '',
          activo: true,
          sortOrder: 1,
          tipo: 'UNCLASSIFIED',
        }),
      ),
    ).resolves.toEqual({
      outcome: 'blocked',
      message: 'La gestión de razas requiere conexión. No se guarda información offline.',
    });
    await expect(firstValueFrom(service.setActive('raza-1', false))).resolves.toEqual({
      outcome: 'blocked',
      message: 'La gestión de razas requiere conexión. No se guarda información offline.',
    });
    expect(post).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(patch).not.toHaveBeenCalled();
  });

  it('should call online mutations with operation id headers and Spanish success feedback', async () => {
    vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(
      '00000000-0000-4000-8000-000000000001',
    );
    const post = vi.fn(() => of(createRaza({ uuid: 'raza-2', nombre: 'Brangus' })));
    const put = vi.fn(() => of(createRaza({ nombre: 'Criolla actualizada' })));
    const patch = vi.fn(() => of(createRaza({ activo: false })));
    const { service } = setup({
      online: true,
      http: { post: post as never, put: put as never, patch: patch as never },
    });

    await expect(
      firstValueFrom(
        service.create({
          nombre: 'Brangus',
          descripcion: '',
          origen: '',
          sortOrder: 2,
          tipo: 'UNCLASSIFIED',
        }),
      ),
    ).resolves.toEqual({
      outcome: 'synced',
      message: 'Raza creada correctamente.',
      raza: createRaza({ uuid: 'raza-2', nombre: 'Brangus' }),
    });
    await expect(
      firstValueFrom(
        service.update('raza-1', {
          nombre: 'Criolla actualizada',
          descripcion: '',
          origen: '',
          activo: true,
          sortOrder: 1,
          tipo: 'UNCLASSIFIED',
        }),
      ),
    ).resolves.toEqual({
      outcome: 'synced',
      message: 'Raza actualizada correctamente.',
      raza: createRaza({ nombre: 'Criolla actualizada' }),
    });
    await expect(firstValueFrom(service.setActive('raza-1', false))).resolves.toEqual({
      outcome: 'synced',
      message: 'Raza desactivada correctamente.',
      raza: createRaza({ activo: false }),
    });

    expect((post.mock.calls[0] as any[])[2].headers.get('X-Operation-Id')).toBe(
      '00000000-0000-4000-8000-000000000001',
    );
    expect(put).toHaveBeenCalledWith(
      '/api/admin/razas/raza-1',
      expect.objectContaining({ activo: true }),
      expect.any(Object),
    );
    expect(patch).toHaveBeenCalledWith(
      '/api/admin/razas/raza-1/active',
      { activo: false },
      expect.any(Object),
    );
  });

  it('should emit RAZA entity changes after online mutation responses', async () => {
    const post = vi.fn(() => of(createRaza({ uuid: 'raza-2', nombre: 'Brangus' })));
    const put = vi.fn(() => of(createRaza({ nombre: 'Criolla actualizada' })));
    const patch = vi.fn(() => of(createRaza({ activo: false })));
    const { service, entityChangeBus } = setup({
      online: true,
      http: { post: post as never, put: put as never, patch: patch as never },
    });
    const changes: string[] = [];
    entityChangeBus.watch(['RAZA']).subscribe((change) => {
      changes.push(`${change.source}:${change.operation}:${change.ids?.join(',')}`);
    });

    await firstValueFrom(
      service.create({
        nombre: 'Brangus',
        descripcion: '',
        origen: '',
        sortOrder: 2,
        tipo: 'UNCLASSIFIED',
      }),
    );
    await firstValueFrom(
      service.update('raza-1', {
        nombre: 'Criolla actualizada',
        descripcion: '',
        origen: '',
        activo: true,
        sortOrder: 1,
        tipo: 'UNCLASSIFIED',
      }),
    );
    await firstValueFrom(service.setActive('raza-1', false));

    expect(changes).toEqual([
      'online-mutation:snapshot-upsert:raza-2',
      'online-mutation:snapshot-upsert:raza-1',
      'online-mutation:snapshot-upsert:raza-1',
    ]);
  });
});

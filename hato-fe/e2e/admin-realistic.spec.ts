import { expect, request, test, type APIRequestContext, type Page } from '@playwright/test';

const apiBaseURL = process.env.E2E_API_URL ?? 'http://localhost:8081';
const adminUsername = process.env.E2E_ADMIN_USERNAME ?? 'root-admin';
const adminPassword = process.env.E2E_ADMIN_PASSWORD ?? 'RootAdmin9';
const ganaderoCount = Number(process.env.E2E_GANADERO_COUNT ?? '10');
const animalsPerGanadero = Number(process.env.E2E_ANIMALS_PER_GANADERO ?? '20');

type GanaderoSeed = {
  id: string;
  name: string;
  businessIdentifier: string;
  animals: AnimalSeed[];
};

type AnimalSeed = {
  uuid: string;
  arete: string;
  category: string;
  sex: string;
};

test.describe('admin realistic operations smoke', () => {
  test('seeds a realistic admin dataset and verifies core admin UI paths', async ({ page }) => {
    const api = await request.newContext({ baseURL: apiBaseURL });
    const token = await loginViaApi(api);
    const runId = uniqueRunId();
    const dataset = await seedRealisticDataset(api, token, runId);
    await api.dispose();

    const targetGanadero = dataset.at(-1)!;
    const targetAnimal = targetGanadero.animals.at(-1)!;

    await loginViaUi(page);

    await expect(page.getByRole('heading', { name: 'Panel' })).toBeVisible();

    await navigateFromSidebar(page, /Ganaderos/);
    await expect(page.getByRole('heading', { name: 'Ganaderos' })).toBeVisible();
    await filterDataTable(page, 'identificador', targetGanadero.businessIdentifier);
    await expect(page.getByText(targetGanadero.businessIdentifier)).toBeVisible();
    await expect(page.getByText(targetGanadero.name)).toBeVisible();

    await navigateFromSidebar(page, /Animales/);
    await expect(page.getByRole('heading', { name: 'Animales' })).toBeVisible();
    await filterDataTable(page, 'animal', targetAnimal.arete);
    await expect(page.getByText(targetAnimal.arete)).toBeVisible();

    await page.getByRole('button', { name: /Ver ficha/ }).click();
    await expect(page.getByRole('heading', { name: 'Ficha animal' })).toBeVisible();
    await expect(page.getByText(targetAnimal.arete)).toBeVisible();
    await expect(page.getByText(/Genealogía|Madre|Padre/)).toBeVisible();

    await navigateFromSidebar(page, /Calendario/);
    await expect(page.getByRole('heading', { name: 'Calendario' })).toBeVisible();
    await expect(page.getByRole('grid', { name: 'Calendario mensual' })).toBeVisible();
    await page.getByRole('button', { name: 'Agendar visita' }).click();
    await scheduleSpecificVetVisit(page, targetAnimal.arete, runId);

    await navigateFromSidebar(page, /Animales/);
    await filterDataTable(page, 'animal', targetAnimal.arete);
    await page.getByRole('button', { name: /Ver ficha/ }).click();
    await page.getByRole('tab', { name: 'Salud' }).click();
    await expect(page.getByText('Visita veterinaria')).toBeVisible();
    await page.getByRole('button', { name: 'Detalles' }).first().click();
    await expect(page.getByRole('dialog').getByText(`Control e2e ${runId}`)).toBeVisible();
  });
});

async function loginViaApi(api: APIRequestContext) {
  const response = await api.post('/api/auth/login', {
    data: { username: adminUsername, password: adminPassword },
  });
  expect(
    response.ok(),
    `admin API login failed: ${response.status()} ${await response.text()}`,
  ).toBeTruthy();
  const body = (await response.json()) as { accessToken: string };
  return body.accessToken;
}

async function loginViaUi(page: Page) {
  await page.goto('/login');
  await page.getByLabel(/Correo o CI/).fill(adminUsername);
  await page.getByLabel(/Contraseña/).fill(adminPassword);
  await page.getByRole('button', { name: /Ingresar|Entrar|Iniciar/ }).click();
  await expect(page).toHaveURL(/\/admin\/dashboard/);
}

async function seedRealisticDataset(api: APIRequestContext, token: string, runId: string) {
  const ganaderos: GanaderoSeed[] = [];

  for (let ganaderoIndex = 1; ganaderoIndex <= ganaderoCount; ganaderoIndex += 1) {
    const ganadero = await createGanadero(api, token, runId, ganaderoIndex);
    ganaderos.push(ganadero);

    const mother = await createAnimal(api, token, ganadero.id, runId, ganaderoIndex, 1, {
      category: 'VACA',
      sex: 'HEMBRA',
    });
    const father = await createAnimal(api, token, ganadero.id, runId, ganaderoIndex, 2, {
      category: 'TORO',
      sex: 'MACHO',
    });
    ganadero.animals.push(mother, father);

    for (let animalIndex = 3; animalIndex <= animalsPerGanadero; animalIndex += 1) {
      const isFemale = animalIndex % 2 === 0;
      const animal = await createAnimal(
        api,
        token,
        ganadero.id,
        runId,
        ganaderoIndex,
        animalIndex,
        {
          category: isFemale ? 'TERNERA' : 'TERNERO',
          sex: isFemale ? 'HEMBRA' : 'MACHO',
          motherAnimalUuid: mother.uuid,
          fatherAnimalUuid: father.uuid,
        },
      );
      ganadero.animals.push(animal);
    }

    await createGeneralEvent(api, token, mother.uuid, runId, ganaderoIndex);
    await createVaccinationEvent(api, token, mother.uuid, runId, ganaderoIndex);
    await createVetVisitEvent(api, token, mother.uuid, runId, ganaderoIndex);
    await createReproductiveService(api, token, mother.uuid, father.uuid, runId, ganaderoIndex);
  }

  return ganaderos;
}

async function createGanadero(
  api: APIRequestContext,
  token: string,
  runId: string,
  index: number,
): Promise<GanaderoSeed> {
  const businessIdentifier = `E2E-${runId}-${String(index).padStart(2, '0')}`;
  const name = `Ganadera E2E ${runId} ${String(index).padStart(2, '0')}`;
  const response = await api.post('/api/admin/ganaderos', {
    headers: authHeaders(token, crypto.randomUUID()),
    data: {
      businessIdentifier,
      name,
      email: `ganadero-${runId}-${index}@e2e.hato.bo`,
      contactInfo: JSON.stringify({ telefono: `7000${String(index).padStart(4, '0')}` }),
    },
  });
  expect(
    response.ok(),
    `create ganadero failed: ${response.status()} ${await response.text()}`,
  ).toBeTruthy();
  const body = (await response.json()) as { id: string };
  return { id: body.id, name, businessIdentifier, animals: [] };
}

async function createAnimal(
  api: APIRequestContext,
  token: string,
  ownerGanaderoId: string,
  runId: string,
  ganaderoIndex: number,
  animalIndex: number,
  options: {
    category: string;
    sex: string;
    motherAnimalUuid?: string;
    fatherAnimalUuid?: string;
  },
): Promise<AnimalSeed> {
  const arete = `E2E-${runId}-${String(ganaderoIndex).padStart(2, '0')}-${String(animalIndex).padStart(2, '0')}`;
  const response = await api.post('/api/animals', {
    headers: authHeaders(token),
    data: {
      ownerGanaderoId,
      motherAnimalUuid: options.motherAnimalUuid,
      fatherAnimalUuid: options.fatherAnimalUuid,
      arete,
      category: options.category,
      sex: options.sex,
      active: true,
      admissionDate: '2026-04-01',
      birthDate: options.category.startsWith('TERNER') ? '2026-03-10' : '2022-01-15',
      weightKg: options.category.startsWith('TERNER') ? 95.5 : 430.25,
      color: animalIndex % 2 === 0 ? 'Colorado' : 'Overo',
      description: `Animal E2E ${runId}`,
    },
  });
  expect(
    response.ok(),
    `create animal failed: ${response.status()} ${await response.text()}`,
  ).toBeTruthy();
  const body = (await response.json()) as { uuid: string };
  return { uuid: body.uuid, arete, category: options.category, sex: options.sex };
}

async function createGeneralEvent(
  api: APIRequestContext,
  token: string,
  animalUuid: string,
  runId: string,
  index: number,
) {
  const operationId = crypto.randomUUID();
  const response = await api.post(`/api/animals/${animalUuid}/events`, {
    headers: authHeaders(token),
    data: {
      animalUuid,
      type: 'OBSERVATION',
      occurredAt: `2026-04-${String(index).padStart(2, '0')}T10:00:00Z`,
      notes: `Observación e2e ${runId}`,
      sourceChannel: 'ONLINE',
      operationId,
      metadata: { source: 'e2e' },
      clientCreatedAt: `2026-04-${String(index).padStart(2, '0')}T10:00:00Z`,
    },
  });
  expect(
    response.ok(),
    `create general event failed: ${response.status()} ${await response.text()}`,
  ).toBeTruthy();
}

async function createVaccinationEvent(
  api: APIRequestContext,
  token: string,
  animalUuid: string,
  runId: string,
  index: number,
) {
  await pushSyncOperation(api, token, {
    entityType: 'ANIMAL_HEALTH_EVENT',
    entityId: crypto.randomUUID(),
    payload: {
      animalUuid,
      healthEventType: 'VACCINATION',
      occurredAt: `2026-04-${String(index).padStart(2, '0')}T11:00:00Z`,
      notes: `Vacunación e2e ${runId}`,
      sourceChannel: 'ONLINE',
      metadata: { productName: 'Vacuna e2e' },
    },
  });
}

async function createVetVisitEvent(
  api: APIRequestContext,
  token: string,
  animalUuid: string,
  runId: string,
  index: number,
) {
  await pushSyncOperation(api, token, {
    entityType: 'ANIMAL_HEALTH_EVENT',
    entityId: crypto.randomUUID(),
    payload: {
      animalUuid,
      healthEventType: 'FIELD_VET_VISIT',
      occurredAt: `2026-05-${String(index).padStart(2, '0')}T09:00:00Z`,
      notes: `Visita e2e ${runId}`,
      sourceChannel: 'ONLINE',
      metadata: {
        visit: {
          visitId: `VISIT-${runId}-${index}`,
          mode: 'SPECIFIC',
          status: 'PENDING',
          veterinarian: { name: 'Dra. E2E', license: 'VET-E2E' },
        },
        clinicalNote: { reason: 'Control e2e', findings: 'Sin novedades', plan: 'Seguimiento' },
      },
    },
  });
}

async function createReproductiveService(
  api: APIRequestContext,
  token: string,
  animalUuid: string,
  fatherAnimalUuid: string,
  runId: string,
  index: number,
) {
  const response = await api.post(`/api/animals/${animalUuid}/reproduction-events`, {
    headers: authHeaders(token),
    data: {
      occurredAt: `2026-04-${String(index).padStart(2, '0')}T12:00:00Z`,
      serviceMethod: 'MONTA_NATURAL',
      fatherAnimalUuid,
      bullReference: `Toro E2E ${runId}`,
      notes: `Servicio e2e ${runId}`,
      operationId: crypto.randomUUID(),
      clientCreatedAt: `2026-04-${String(index).padStart(2, '0')}T12:00:00Z`,
    },
  });
  expect(
    response.ok(),
    `create reproductive service failed: ${response.status()} ${await response.text()}`,
  ).toBeTruthy();
}

async function pushSyncOperation(
  api: APIRequestContext,
  token: string,
  input: { entityType: string; entityId: string; payload: Record<string, unknown> },
) {
  const operationId = crypto.randomUUID();
  const clientCreatedAt = String(input.payload['occurredAt'] ?? new Date().toISOString());
  const response = await api.post('/api/sync/push', {
    headers: authHeaders(token),
    data: {
      operations: [
        {
          operationId,
          entityType: input.entityType,
          entityId: input.entityId,
          opType: 'CREATE',
          payload: {
            ...input.payload,
            operationId,
          },
          baseVersion: 0,
          clientCreatedAt,
          clientUpdatedAt: clientCreatedAt,
        },
      ],
    },
  });
  expect(
    response.ok(),
    `sync push failed: ${response.status()} ${await response.text()}`,
  ).toBeTruthy();
}

async function navigateFromSidebar(page: Page, name: RegExp) {
  await page.getByRole('link', { name }).click();
}

async function filterDataTable(page: Page, columnLabel: string, value: string) {
  await page.getByRole('button', { name: `Filtrar ${columnLabel}` }).click();
  await page.getByRole('textbox', { name: `Filtrar ${columnLabel}` }).fill(value);
  await page.keyboard.press('Escape');
}

async function scheduleSpecificVetVisit(page: Page, animalArete: string, runId: string) {
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('Modo').click();
  await page.getByRole('option', { name: 'Específica' }).click();
  await page.getByLabel('Animal').fill(animalArete);
  await page.getByRole('option', { name: new RegExp(animalArete) }).click();
  await page.getByLabel('Veterinario').fill('Dra. Playwright');
  await page.getByLabel('Matrícula veterinaria').fill('VET-PW');
  await page.getByLabel('Motivo').fill(`Control e2e ${runId}`);
  const pushResponse = page.waitForResponse(
    (response) =>
      response.url().includes('/api/sync/push') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: /Agendar|Guardar|Registrar/ }).click();
  await expect(page.getByRole('dialog')).toBeHidden();
  expect((await pushResponse).ok()).toBeTruthy();
}

function authHeaders(token: string, operationId?: string) {
  return {
    Authorization: `Bearer ${token}`,
    ...(operationId ? { 'X-Operation-Id': operationId } : {}),
  };
}

function uniqueRunId() {
  return Date.now().toString(36).slice(-6);
}

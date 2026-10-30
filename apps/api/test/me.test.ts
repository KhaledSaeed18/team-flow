import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHarness, type Harness } from './harness.ts';

describe('me.get', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(() => h.destroy());

  test('rejects anonymous callers', async () => {
    await expect(h.visitor().client.me.get()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  test('returns the user and the organizations they belong to', async () => {
    const ada = await h.owner('Ada');
    const me = await ada.client.me.get();
    expect(me.user.email).toBe('ada@example.com');
    expect(me.activeOrganizationId).toBe(ada.organizationId);
    expect(me.organizations).toEqual([
      { id: ada.organizationId, name: "Ada's org", slug: 'ada-org', logo: null, role: 'owner' },
    ]);
  });

  test('does not show other people’s organizations', async () => {
    await h.owner('Grace');
    const linus = await h.user('Linus');
    const me = await linus.client.me.get();
    expect(me.organizations).toEqual([]);
    expect(me.activeOrganizationId).toBeNull();
  });

  test('is also served as REST for third parties', async () => {
    const ken = await h.owner('Ken');
    const response = await ken.fetch('/api/v1/me');
    expect(response.status).toBe(200);
    expect(((await response.json()) as { user: { email: string } }).user.email).toBe(
      'ken@example.com',
    );
  });
});

describe('platform routes', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(() => h.destroy());

  test('health and readiness', async () => {
    expect((await h.app.request('/health')).status).toBe(200);
    expect((await h.app.request('/ready')).status).toBe(200);
  });

  test('the OpenAPI document lists contract routes', async () => {
    const spec = (await (await h.app.request('/api/openapi.json')).json()) as {
      paths: Record<string, unknown>;
    };
    expect(Object.keys(spec.paths)).toContain('/me');
  });

  test('the OpenAPI document reads cleanly: no safe-integer bounds, described errors', async () => {
    const text = await (await h.app.request('/api/openapi.json')).text();
    expect(text).not.toContain(String(Number.MIN_SAFE_INTEGER));
    expect(text).not.toContain(String(Number.MAX_SAFE_INTEGER));
    const spec = JSON.parse(text) as {
      paths: Record<string, Record<string, { responses: Record<string, { description: string }> }>>;
    };
    const move = spec.paths['/tasks/{id}/move']?.post;
    expect(move?.responses['409']?.description).toContain(
      '`CONFLICT`: This was changed by someone else. Reload and try again.',
    );
    expect(move?.responses['409']?.description).toContain('`SPRINT_STATE`');
    for (const [status, response] of Object.entries(move?.responses ?? {})) {
      if (status !== '200') expect(response.description).not.toBe(status);
    }
  });

  test('unknown routes are JSON 404s', async () => {
    const response = await h.app.request('/nope');
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'NOT_FOUND' });
  });
});

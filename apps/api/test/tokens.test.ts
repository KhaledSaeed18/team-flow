import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHarness, type Harness } from './harness.ts';

describe('personal access tokens', () => {
  let h: Harness;
  let ada: Awaited<ReturnType<Harness['owner']>>;
  let projectId: string;

  /** A bare REST call with no cookies, only the token. */
  const rest = (secret: string, path: string, init: RequestInit = {}) =>
    h.app.fetch(
      new Request(`http://api.test/api/v1${path}`, {
        ...init,
        headers: {
          authorization: `Bearer ${secret}`,
          'content-type': 'application/json',
          ...init.headers,
        },
      }),
    );

  beforeAll(async () => {
    h = await createHarness();
    ada = await h.owner('Ada');
    projectId = (await ada.client.projects.create({ key: 'TOK', name: 'Tokens' })).id;
  });
  afterAll(() => h.destroy());

  test('the secret is shown once, stored hashed, and acts as its owner in the workspace', async () => {
    const { token, secret } = await ada.client.tokens.create({ name: 'CI', access: 'write' });
    expect(secret).toStartWith('tf_');
    expect(token.prefix).toBe(`${secret.slice(0, 9)}…`);
    expect(token.expiresAt?.toISOString()).toBe('2026-05-31T09:00:00.000Z');
    const listed = await ada.client.tokens.list();
    expect(JSON.stringify(listed)).not.toContain(secret);

    const me = await rest(secret, '/me');
    expect(me.status).toBe(200);
    expect(((await me.json()) as { user: { name: string } }).user.name).toBe('Ada');

    const created = await rest(secret, '/tasks', {
      method: 'POST',
      body: JSON.stringify({ projectId, title: 'Filed by a script' }),
    });
    expect(created.status).toBe(201);
    expect((await ada.client.tokens.list())[0]?.lastUsedAt).not.toBeNull();
  });

  test('read tokens can only read', async () => {
    const { secret } = await ada.client.tokens.create({ name: 'Dashboard' });
    expect((await rest(secret, '/projects')).status).toBe(200);
    const write = await rest(secret, '/tasks', {
      method: 'POST',
      body: JSON.stringify({ projectId, title: 'Nope' }),
    });
    expect(write.status).toBe(403);
  });

  test('tokens cannot manage tokens, and only work on the public API', async () => {
    const { secret } = await ada.client.tokens.create({ name: 'Script', access: 'write' });
    const mint = await rest(secret, '/tokens', {
      method: 'POST',
      body: JSON.stringify({ name: 'Escalated', access: 'write' }),
    });
    expect(mint.status).toBe(403);
    expect((await rest(secret, '/tokens')).status).toBe(403);

    const rpc = await h.app.fetch(
      new Request('http://api.test/rpc/me/get', {
        method: 'POST',
        headers: { authorization: `Bearer ${secret}`, 'content-type': 'application/json' },
        body: '{}',
      }),
    );
    expect(rpc.status).toBe(401);
  });

  test('revoked, expired, unknown and malformed tokens are refused', async () => {
    const { token, secret } = await ada.client.tokens.create({ name: 'Old', expiresInDays: 30 });
    expect((await rest(secret, '/me')).status).toBe(200);

    h.clock.advance(31 * 24 * 60 * 60 * 1000);
    expect((await rest(secret, '/me')).status).toBe(401);

    await ada.client.tokens.revoke({ id: token.id });
    expect((await rest(secret, '/me')).status).toBe(401);
    expect((await rest('tf_not-a-real-token', '/me')).status).toBe(401);
    expect((await rest('hunter2', '/me')).status).toBe(401);
  });

  test('tokens die with the membership, and stay private to their owner', async () => {
    const linus = await h.join(ada, 'Linus', 'member');
    const { token, secret } = await linus.client.tokens.create({ name: 'Mine' });
    await expect(ada.client.tokens.revoke({ id: token.id })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
    expect((await ada.client.tokens.list()).map((t) => t.id)).not.toContain(token.id);

    const members = await ada.client.members.list();
    const member = members.find((m) => m.name === 'Linus');
    await ada.authPost('/organization/remove-member', {
      memberIdOrEmail: member?.id,
      organizationId: ada.organizationId,
    });
    expect((await rest(secret, '/me')).status).toBe(401);
  });
});

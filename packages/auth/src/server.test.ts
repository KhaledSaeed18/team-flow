import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createTestDatabase, type TestDatabase } from '@teamflow/db/testing';
import { type AuthEmail, createAuth } from './server.ts';

const BASE = 'http://localhost:4000';
const ORIGIN = 'http://localhost:5173';

/** A browser stand-in: sends requests through the auth handler and keeps its cookies. */
function browser(handler: (request: Request) => Promise<Response>) {
  const jar = new Map<string, string>();
  return async function call<T = unknown>(
    path: string,
    body?: unknown,
  ): Promise<{ status: number; data: T }> {
    const headers = new Headers({ origin: ORIGIN });
    if (body !== undefined) headers.set('content-type', 'application/json');
    if (jar.size > 0) headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
    const response = await handler(
      new Request(`${BASE}/api/auth${path}`, {
        method: body === undefined ? 'GET' : 'POST',
        headers,
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      }),
    );
    for (const cookie of response.headers.getSetCookie()) {
      const [pair = ''] = cookie.split(';');
      const [name = '', value = ''] = pair.split('=');
      if (value === '') jar.delete(name);
      else jar.set(name, value);
    }
    const text = await response.text();
    return { status: response.status, data: (text ? JSON.parse(text) : null) as T };
  };
}

describe('auth flow', () => {
  let database: TestDatabase;
  const outbox: AuthEmail[] = [];
  let auth: ReturnType<typeof createAuth>;
  const created: string[] = [];

  const lastCode = (to: string) => {
    const email = outbox.findLast((e) => e.to === to && 'code' in e);
    if (!email || !('code' in email)) throw new Error(`no code sent to ${to}`);
    return email.code;
  };

  beforeAll(async () => {
    database = await createTestDatabase();
    auth = createAuth({
      db: database.db,
      secret: 'test-secret-that-is-long-enough-for-better-auth',
      baseURL: BASE,
      trustedOrigins: [ORIGIN],
      rateLimit: false,
      sendEmail: async (email) => {
        outbox.push(email);
      },
      onOrganizationCreated: async (organizationId) => {
        created.push(organizationId);
      },
    });
  });

  afterAll(async () => {
    await database.destroy();
  });

  async function verifiedUser(name: string, email: string) {
    const call = browser(auth.handler);
    const signUp = await call('/sign-up/email', { name, email, password: 'correct horse battery' });
    expect(signUp.status).toBe(200);
    const verify = await call('/email-otp/verify-email', { email, otp: lastCode(email) });
    expect(verify.status).toBe(200);
    return call;
  }

  test('sign up requires verifying the emailed code before signing in', async () => {
    const call = browser(auth.handler);
    await call('/sign-up/email', {
      name: 'Una Verified',
      email: 'una@example.com',
      password: 'correct horse battery',
    });
    expect(outbox.at(-1)).toMatchObject({ kind: 'verify-email', to: 'una@example.com' });

    const early = await call('/sign-in/email', {
      email: 'una@example.com',
      password: 'correct horse battery',
    });
    expect(early.status).toBe(403);

    const wrong = await call('/email-otp/verify-email', {
      email: 'una@example.com',
      otp: '000000',
    });
    expect(wrong.status).toBe(400);
  });

  test('ids are uuid v7 and passwords are not stored in the clear', async () => {
    await verifiedUser('Ada', 'ada@example.com');
    const user = await database.db.query.users.findFirst({
      where: (u, { eq }) => eq(u.email, 'ada@example.com'),
      with: { accounts: true },
    });
    expect(user?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7/);
    expect(user?.emailVerified).toBe(true);
    expect(user?.accounts[0]?.password).not.toContain('correct horse');
  });

  test('an owner creates an organization and invites a member who accepts', async () => {
    const owner = await verifiedUser('Grace', 'grace@example.com');
    const org = await owner<{ id: string }>('/organization/create', { name: 'Acme', slug: 'acme' });
    expect(org.status).toBe(200);
    expect(created).toContain(org.data.id);

    const invite = await owner<{ id: string }>('/organization/invite-member', {
      email: 'linus@example.com',
      role: 'member',
      organizationId: org.data.id,
    });
    expect(invite.status).toBe(200);
    expect(outbox.at(-1)).toMatchObject({
      kind: 'invitation',
      to: 'linus@example.com',
      organizationName: 'Acme',
      role: 'member',
    });

    const invitee = await verifiedUser('Linus', 'linus@example.com');
    const accept = await invitee('/organization/accept-invitation', {
      invitationId: invite.data.id,
    });
    expect(accept.status).toBe(200);

    const members = await database.db.query.members.findMany({
      where: (m, { eq }) => eq(m.organizationId, org.data.id),
      with: { user: true },
    });
    expect(members.map((m) => [m.user.email, m.role]).sort()).toEqual([
      ['grace@example.com', 'owner'],
      ['linus@example.com', 'member'],
    ]);
  });

  test('a member cannot invite people', async () => {
    const owner = await verifiedUser('Barbara', 'barbara@example.com');
    const org = await owner<{ id: string }>('/organization/create', {
      name: 'Globex',
      slug: 'globex',
    });
    const invite = await owner<{ id: string }>('/organization/invite-member', {
      email: 'ken@example.com',
      role: 'member',
      organizationId: org.data.id,
    });
    const ken = await verifiedUser('Ken', 'ken@example.com');
    await ken('/organization/accept-invitation', { invitationId: invite.data.id });

    const attempt = await ken('/organization/invite-member', {
      email: 'dennis@example.com',
      role: 'member',
      organizationId: org.data.id,
    });
    expect(attempt.status).toBe(403);
  });
});

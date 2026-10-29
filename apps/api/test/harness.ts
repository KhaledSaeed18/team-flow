import { createORPCClient } from '@orpc/client';
import { RPCLink } from '@orpc/client/fetch';
import { type AuthEmail, createAuth } from '@teamflow/auth';
import type { Client } from '@teamflow/contract';
import { createTestDatabase, type TestDatabase } from '@teamflow/db/testing';
import { fixedClock } from '@teamflow/domain';
import { createApp } from '../src/app.ts';
import { createLogger } from '../src/logger.ts';

const API_URL = 'http://api.test';
const WEB_URL = 'http://web.test';

/**
 * A full api in-process against its own database. Requests go through `app.fetch`, so middleware, auth and
 * serialization are exercised exactly as in production — only the socket is missing.
 */
export async function createHarness() {
  const database: TestDatabase = await createTestDatabase();
  const emails: AuthEmail[] = [];
  const clock = fixedClock('2026-03-02T09:00:00Z');
  const auth = createAuth({
    db: database.db,
    secret: 'test-secret-that-is-long-enough-for-better-auth',
    baseURL: API_URL,
    trustedOrigins: [WEB_URL],
    rateLimit: false,
    sendEmail: async (email) => {
      emails.push(email);
    },
  });
  const app = createApp(
    { db: database.db, auth, clock, logger: createLogger('silent') },
    { apiUrl: API_URL, webUrl: WEB_URL },
  );

  /** A signed-out visitor with its own cookie jar. */
  function visitor() {
    const jar = new Map<string, string>();

    async function fetch(input: Request | string, init?: RequestInit): Promise<Response> {
      const request =
        typeof input === 'string'
          ? new Request(new URL(input, API_URL).href, init)
          : new Request(input, init);
      request.headers.set('origin', WEB_URL);
      if (jar.size > 0) {
        request.headers.set('cookie', [...jar].map(([k, v]) => `${k}=${v}`).join('; '));
      }
      const response = await app.fetch(request);
      for (const cookie of response.headers.getSetCookie()) {
        const [pair = ''] = cookie.split(';');
        const index = pair.indexOf('=');
        const name = pair.slice(0, index);
        const value = pair.slice(index + 1);
        if (value === '') jar.delete(name);
        else jar.set(name, value);
      }
      return response;
    }

    const authPost = async (path: string, body: unknown) => {
      const response = await fetch(`/api/auth${path}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`${path} → ${response.status} ${await response.text()}`);
      return response.json() as Promise<Record<string, unknown>>;
    };

    const client: Client = createORPCClient(
      new RPCLink({
        url: `${API_URL}/rpc`,
        fetch: (request, init) => fetch(request as Request, init),
      }),
    );

    const cookie = () => [...jar].map(([k, v]) => `${k}=${v}`).join('; ');

    return { fetch, authPost, client, cookie };
  }

  /** Sign up and verify a user; returns a signed-in visitor. */
  async function user(name: string, email = `${name.toLowerCase()}@example.com`) {
    const v = visitor();
    await v.authPost('/sign-up/email', { name, email, password: 'correct horse battery' });
    const sent = emails.findLast((e) => e.to === email && e.kind === 'verify-email');
    if (!sent || !('code' in sent)) throw new Error(`no verification code for ${email}`);
    await v.authPost('/email-otp/verify-email', { email, otp: sent.code });
    return { ...v, email };
  }

  /** A user who owns a fresh organization, set active. */
  async function owner(name: string, slug = `${name.toLowerCase()}-org`) {
    const u = await user(name);
    const org = await u.authPost('/organization/create', { name: `${name}'s org`, slug });
    await u.authPost('/organization/set-active', { organizationId: org.id });
    return { ...u, organizationId: String(org.id) };
  }

  type Signed = Awaited<ReturnType<typeof user>>;

  /** Invite a new user into `inviter`'s active organization with `role`, accept, and make it their active org. */
  async function join(
    inviter: Signed & { organizationId: string },
    name: string,
    role: 'admin' | 'member' | 'guest',
  ) {
    const u = await user(name);
    const invitation = await inviter.authPost('/organization/invite-member', {
      email: u.email,
      role,
      organizationId: inviter.organizationId,
    });
    await u.authPost('/organization/accept-invitation', { invitationId: invitation.id });
    await u.authPost('/organization/set-active', { organizationId: inviter.organizationId });
    return { ...u, organizationId: inviter.organizationId };
  }

  return {
    app,
    auth,
    database,
    db: database.db,
    emails,
    clock,
    visitor,
    user,
    owner,
    join,
    destroy: database.destroy,
  };
}

export type Harness = Awaited<ReturnType<typeof createHarness>>;

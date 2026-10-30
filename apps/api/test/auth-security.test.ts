import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { CLIENT_IP_HEADER, createAuth } from '@teamflow/auth';
import { createTestDatabase, type TestDatabase } from '@teamflow/db/testing';
import { withClientIp } from '../src/client-ip.ts';
import { createHarness, type Harness } from './harness.ts';

describe('sign-in rate limit', () => {
  let t: TestDatabase;
  beforeAll(async () => {
    t = await createTestDatabase();
  });
  afterAll(() => t.destroy());

  test('a forged X-Forwarded-For does not buy a fresh bucket per attempt', async () => {
    const auth = createAuth({
      db: t.db,
      secret: 'test-secret-that-is-long-enough-for-better-auth',
      baseURL: 'http://api.test',
      trustedOrigins: ['http://web.test'],
      rateLimit: true,
      sendEmail: async () => {},
    });
    const statuses: number[] = [];
    for (let i = 0; i < 5; i++) {
      const forged = new Request('http://api.test/api/auth/sign-in/email', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          origin: 'http://web.test',
          'x-forwarded-for': `203.0.113.${i}`,
          [CLIENT_IP_HEADER]: `198.51.100.${i}`,
        },
        body: JSON.stringify({ email: 'nobody@example.com', password: 'wrong password' }),
      });
      // What the server does to every request: the address it saw replaces whatever the client claimed.
      statuses.push((await auth.handler(withClientIp(forged, '192.0.2.10'))).status);
    }
    expect(statuses.slice(-2)).toEqual([429, 429]);
  });

  test('the client cannot set the address header itself', () => {
    const spoofed = new Request('http://api.test/', { headers: { [CLIENT_IP_HEADER]: '1.2.3.4' } });
    expect(withClientIp(spoofed, '192.0.2.10').headers.get(CLIENT_IP_HEADER)).toBe('192.0.2.10');
    expect(withClientIp(spoofed, null).headers.get(CLIENT_IP_HEADER)).toBeNull();
  });
});

describe('password reset', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(() => h.destroy());

  test('resetting a password signs out every existing session', async () => {
    const ada = await h.owner('Ada');
    const session = (await (await ada.fetch('/api/auth/get-session')).json()) as {
      user?: { email: string };
    } | null;
    expect(session?.user?.email).toBe(ada.email);

    await ada.authPost('/email-otp/send-verification-otp', {
      email: ada.email,
      type: 'forget-password',
    });
    const sent = h.emails.findLast((e) => e.to === ada.email && e.kind === 'reset-password');
    if (!sent || !('code' in sent)) throw new Error('no reset code');
    const stranger = h.visitor();
    await stranger.authPost('/email-otp/reset-password', {
      email: ada.email,
      otp: sent.code,
      password: 'a completely new passphrase',
    });

    // The cookie from before the reset no longer signs anyone in.
    expect(await (await ada.fetch('/api/auth/get-session')).json()).toBeNull();
  });
});

describe('roles', () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(() => h.destroy());

  test('a member gets exactly one role: lists are refused on invite and on change', async () => {
    const ada = await h.owner('Ada');
    const pat = await h.join(ada, 'Pat', 'member');
    const member = (await ada.client.members.list()).find((m) => m.name === 'Pat');
    const change = await ada.fetch('/api/auth/organization/update-member-role', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ memberId: member?.id, role: ['guest', 'admin'] }),
    });
    expect(change.status).toBe(400);
    expect(((await change.json()) as { message: string }).message).toBe(
      'A member has exactly one role.',
    );
    const invite = await ada.fetch('/api/auth/organization/invite-member', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'two@example.com', role: 'member,admin' }),
    });
    expect(invite.status).toBe(400);
    expect(((await invite.json()) as { message: string }).message).toBe(
      'A member has exactly one role.',
    );
    expect((await ada.client.members.list()).find((m) => m.name === 'Pat')?.role).toBe('member');
    void pat;
  });
});

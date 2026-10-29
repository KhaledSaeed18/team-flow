import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHarness, type Harness } from './harness.ts';

describe('account', () => {
  let h: Harness;

  beforeAll(async () => {
    h = await createHarness();
  });
  afterAll(() => h.destroy());

  test('a new name shows wherever the person appears', async () => {
    const ada = await h.owner('Ada');
    await ada.authPost('/update-user', { name: 'Ada Lovelace' });
    expect((await ada.client.me.get()).user.name).toBe('Ada Lovelace');
    expect((await ada.client.members.list()).map((m) => m.name)).toContain('Ada Lovelace');
  });

  test('changing the password can sign out every other device', async () => {
    const linus = await h.user('Linus');
    const laptop = h.visitor();
    await laptop.authPost('/sign-in/email', {
      email: linus.email,
      password: 'correct horse battery',
    });
    const sessions = (await (await linus.fetch('/api/auth/list-sessions')).json()) as unknown[];
    expect(sessions).toHaveLength(2);

    await expect(
      linus.authPost('/change-password', {
        currentPassword: 'wrong',
        newPassword: 'a brand new passphrase',
      }),
    ).rejects.toThrow();
    await linus.authPost('/change-password', {
      currentPassword: 'correct horse battery',
      newPassword: 'a brand new passphrase',
      revokeOtherSessions: true,
    });

    const after = (await (await linus.fetch('/api/auth/list-sessions')).json()) as unknown[];
    expect(after).toHaveLength(1);
    const fresh = h.visitor();
    await fresh.authPost('/sign-in/email', {
      email: linus.email,
      password: 'a brand new passphrase',
    });
  });

  test('revoking a session signs that device out', async () => {
    const grace = await h.user('Grace');
    const phone = h.visitor();
    await phone.authPost('/sign-in/email', {
      email: grace.email,
      password: 'correct horse battery',
    });
    const sessions = (await (await grace.fetch('/api/auth/list-sessions')).json()) as {
      token: string;
    }[];
    const current = (await (await grace.fetch('/api/auth/get-session')).json()) as {
      session: { token: string };
    };
    const other = sessions.find((s) => s.token !== current.session.token);
    await grace.authPost('/revoke-session', { token: other?.token });

    await expect(phone.client.me.get()).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect((await grace.client.me.get()).user.email).toBe(grace.email);
  });
});

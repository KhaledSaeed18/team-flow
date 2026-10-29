import { describe, expect, test } from 'bun:test';
import { deliverEmails, type Mailer } from './email.ts';

const options = (mailer: Mailer, dropped: string[] = []) => ({
  mailer,
  from: 'TeamFlow <no-reply@teamflow.test>',
  webUrl: 'https://app.teamflow.test',
  onDropped: (id: string) => dropped.push(id),
});

describe('deliverEmails', () => {
  test('renders and sends each message', async () => {
    const sent: { to: string; subject: string; from: string }[] = [];
    await deliverEmails(
      [
        { id: '1', data: { kind: 'verify-email', to: 'ada@example.com', code: '111111' } },
        { id: '2', data: { kind: 'reset-password', to: 'grace@example.com', code: '222222' } },
      ],
      options({ sendMail: async (mail) => sent.push(mail) }),
    );
    expect(sent.map((m) => [m.to, m.subject, m.from])).toEqual([
      [
        'ada@example.com',
        '111111 is your TeamFlow verification code',
        'TeamFlow <no-reply@teamflow.test>',
      ],
      [
        'grace@example.com',
        '222222 is your TeamFlow password reset code',
        'TeamFlow <no-reply@teamflow.test>',
      ],
    ]);
  });

  test('drops malformed jobs instead of retrying them forever', async () => {
    const dropped: string[] = [];
    const sent: unknown[] = [];
    await deliverEmails(
      [{ id: 'bad', data: { kind: 'unknown' } }],
      options({ sendMail: async (mail) => sent.push(mail) }, dropped),
    );
    expect(dropped).toEqual(['bad']);
    expect(sent).toEqual([]);
  });

  test('a delivery failure throws so the queue retries', async () => {
    await expect(
      deliverEmails(
        [{ id: '1', data: { kind: 'verify-email', to: 'ada@example.com', code: '1' } }],
        options({
          sendMail: async () => {
            throw new Error('smtp down');
          },
        }),
      ),
    ).rejects.toThrow('smtp down');
  });
});

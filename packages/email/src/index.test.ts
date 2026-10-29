import { describe, expect, test } from 'bun:test';
import { renderEmail } from './index.ts';

const options = { webUrl: 'https://app.teamflow.test' };

describe('renderEmail', () => {
  test('a verification code email puts the code in the subject, the html and the text', async () => {
    const email = await renderEmail(
      { kind: 'verify-email', to: 'ada@example.com', code: '482913' },
      options,
    );
    expect(email.to).toBe('ada@example.com');
    expect(email.subject).toBe('482913 is your TeamFlow verification code');
    expect(email.html).toContain('482913');
    expect(email.text).toContain('482913');
    expect(email.text).not.toContain('<');
  });

  test('an invitation links to the web app', async () => {
    const email = await renderEmail(
      {
        kind: 'invitation',
        to: 'linus@example.com',
        invitationId: 'inv-1',
        organizationName: 'Acme',
        inviterName: 'Grace',
        role: 'admin',
      },
      options,
    );
    expect(email.subject).toBe('Grace invited you to Acme');
    expect(email.html).toContain('https://app.teamflow.test/invitations/inv-1');
    expect(email.text).toContain('as an admin');
  });
});

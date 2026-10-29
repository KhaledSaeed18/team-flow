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

  test('a digest lists items with links to each task and counts the rest', async () => {
    const email = await renderEmail(
      {
        kind: 'digest',
        to: 'ada@example.com',
        name: 'Ada Lovelace',
        organizationName: 'Acme',
        frequency: 'daily',
        items: [
          {
            kind: 'mentioned',
            actorName: 'Linus',
            identifier: 'RF-12',
            title: 'Lidar driver timeouts',
            excerpt: 'Can you look at the retry?',
          },
          { kind: 'assigned', actorName: null, identifier: 'FC-3', title: 'Fleet map' },
        ],
        more: 3,
      },
      options,
    );
    expect(email.subject).toBe('5 unread in Acme');
    expect(email.html).toContain('https://app.teamflow.test/p/RF?task=RF-12');
    expect(email.text).toContain('Linus mentioned you on');
    expect(email.text).toContain('Someone assigned you');
    expect(email.text).toContain('Can you look at the retry?');
    expect(email.text).toContain('And 3 more.');
    expect(email.text).toContain('https://app.teamflow.test/settings/account');
  });
});

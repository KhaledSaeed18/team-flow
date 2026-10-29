import { render } from '@react-email/render';
import { createElement } from 'react';
import type { EmailMessage } from './messages.ts';
import { CodeEmail, DigestEmail, InvitationEmail } from './templates.tsx';

export * from './messages.ts';

export interface RenderedEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface RenderOptions {
  /** Public URL of the web app, for links. */
  webUrl: string;
}

/** Turn a message into a subject, HTML and a plain-text alternative. */
export async function renderEmail(
  message: EmailMessage,
  { webUrl }: RenderOptions,
): Promise<RenderedEmail> {
  const [subject, element] = (() => {
    switch (message.kind) {
      case 'verify-email':
        return [
          `${message.code} is your TeamFlow verification code`,
          createElement(CodeEmail, {
            title: 'Confirm your email',
            intro: 'Enter this code in TeamFlow to finish creating your account.',
            code: message.code,
          }),
        ] as const;
      case 'sign-in-code':
        return [
          `${message.code} is your TeamFlow sign-in code`,
          createElement(CodeEmail, {
            title: 'Sign in',
            intro: 'Enter this code to sign in.',
            code: message.code,
          }),
        ] as const;
      case 'reset-password':
        return [
          `${message.code} is your TeamFlow password reset code`,
          createElement(CodeEmail, {
            title: 'Reset your password',
            intro: 'Enter this code to choose a new password.',
            code: message.code,
          }),
        ] as const;
      case 'invitation':
        return [
          `${message.inviterName} invited you to ${message.organizationName}`,
          createElement(InvitationEmail, {
            inviterName: message.inviterName,
            organizationName: message.organizationName,
            role: message.role,
            url: `${webUrl}/invitations/${message.invitationId}`,
          }),
        ] as const;
      case 'digest': {
        const total = message.items.length + message.more;
        return [
          `${total} unread in ${message.organizationName}`,
          createElement(DigestEmail, {
            name: message.name,
            organizationName: message.organizationName,
            frequency: message.frequency,
            more: message.more,
            items: message.items.map((item) => ({
              ...item,
              url: `${webUrl}/p/${item.identifier.split('-')[0]}?task=${item.identifier}`,
            })),
            inboxUrl: `${webUrl}/inbox`,
            settingsUrl: `${webUrl}/settings/account`,
          }),
        ] as const;
      }
    }
  })();

  return {
    to: message.to,
    subject,
    html: await render(element),
    text: await render(element, { plainText: true }),
  };
}

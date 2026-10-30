import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { ReactNode } from 'react';

/** The content id of the inline logo every email carries (see `logoAttachment`). */
export const LOGO_CID = 'teamflow-mark';

/**
 * Plain, readable emails: one column, system fonts (custom fonts are unreliable in mail clients), the product's ink
 * and canvas colours, and the code or the action as the only emphasis.
 */

const colors = {
  canvas: '#eef1f4',
  surface: '#ffffff',
  ink: '#1b2430',
  muted: '#5b6878',
  line: '#d5dbe2',
};
const font = '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif';

const DEFAULT_FOOTER =
  'You are receiving this because of an action on your TeamFlow account. If it was not you, you can ignore it.';

function Layout({
  preview,
  title,
  children,
  footer = DEFAULT_FOOTER,
}: {
  preview: string;
  title: string;
  children: ReactNode;
  footer?: string;
}) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{ backgroundColor: colors.canvas, fontFamily: font, margin: 0, padding: '32px 0' }}
      >
        <Container
          style={{
            backgroundColor: colors.surface,
            border: `1px solid ${colors.line}`,
            borderRadius: 12,
            maxWidth: 480,
            padding: '32px 32px 24px',
          }}
        >
          <Section style={{ margin: '0 0 24px' }}>
            <Img
              src={`cid:${LOGO_CID}`}
              width="24"
              height="24"
              alt=""
              style={{ display: 'inline-block', verticalAlign: 'middle', borderRadius: 6 }}
            />
            <span
              style={{
                color: colors.ink,
                fontSize: 15,
                fontWeight: 600,
                marginLeft: 8,
                verticalAlign: 'middle',
              }}
            >
              TeamFlow
            </span>
          </Section>
          <Heading
            as="h1"
            style={{ color: colors.ink, fontSize: 20, fontWeight: 600, margin: '0 0 12px' }}
          >
            {title}
          </Heading>
          {children}
          <Hr style={{ borderColor: colors.line, margin: '28px 0 16px' }} />
          <Text style={{ color: colors.muted, fontSize: 12, margin: 0 }}>{footer}</Text>
        </Container>
      </Body>
    </Html>
  );
}

const paragraph = { color: colors.ink, fontSize: 14, lineHeight: '22px', margin: '0 0 16px' };

function Code({ code }: { code: string }) {
  return (
    <Section
      style={{
        backgroundColor: colors.canvas,
        borderRadius: 8,
        margin: '8px 0 16px',
        padding: '16px 0',
        textAlign: 'center',
      }}
    >
      <Text
        style={{ color: colors.ink, fontSize: 28, fontWeight: 600, letterSpacing: 8, margin: 0 }}
      >
        {code}
      </Text>
    </Section>
  );
}

export function CodeEmail({ title, intro, code }: { title: string; intro: string; code: string }) {
  return (
    <Layout preview={`${code} is your TeamFlow code`} title={title}>
      <Text style={paragraph}>{intro}</Text>
      <Code code={code} />
      <Text style={{ ...paragraph, color: colors.muted, fontSize: 13 }}>
        The code expires in 10 minutes.
      </Text>
    </Layout>
  );
}

export function InvitationEmail({
  inviterName,
  organizationName,
  role,
  url,
}: {
  inviterName: string;
  organizationName: string;
  role: string;
  url: string;
}) {
  return (
    <Layout
      preview={`${inviterName} invited you to ${organizationName}`}
      title={`Join ${organizationName} on TeamFlow`}
    >
      <Text style={paragraph}>
        {inviterName} invited you to the {organizationName} workspace as{' '}
        {role === 'admin' ? 'an admin' : `a ${role}`}.
      </Text>
      <Button
        href={url}
        style={{
          backgroundColor: colors.ink,
          borderRadius: 6,
          color: colors.canvas,
          display: 'inline-block',
          fontSize: 14,
          fontWeight: 600,
          padding: '10px 16px',
        }}
      >
        Accept invitation
      </Button>
      <Text style={{ ...paragraph, color: colors.muted, fontSize: 13, marginTop: 16 }}>
        The invitation expires in 7 days.
      </Text>
    </Layout>
  );
}

export interface DigestItem {
  kind: 'assigned' | 'mentioned' | 'commented';
  actorName: string | null;
  identifier: string;
  title: string;
  excerpt?: string | undefined;
  url: string;
}

const VERB: Record<DigestItem['kind'], string> = {
  assigned: 'assigned you',
  mentioned: 'mentioned you on',
  commented: 'commented on',
};

export function DigestEmail({
  name,
  organizationName,
  frequency,
  items,
  more,
  inboxUrl,
  settingsUrl,
}: {
  name: string;
  organizationName: string;
  frequency: 'daily' | 'weekly';
  items: DigestItem[];
  more: number;
  inboxUrl: string;
  settingsUrl: string;
}) {
  const total = items.length + more;
  return (
    <Layout
      preview={`${total} unread in ${organizationName}`}
      title={`Your ${frequency === 'daily' ? 'daily' : 'weekly'} summary`}
      footer={`You get this ${frequency} summary of unread notifications in ${organizationName}. Change how often in account settings: ${settingsUrl}`}
    >
      <Text style={paragraph}>
        Hi {name.split(' ')[0]}, here is what is waiting for you in {organizationName}.
      </Text>
      {items.map((item) => (
        <Section
          key={`${item.identifier}-${item.kind}-${item.excerpt ?? ''}`}
          style={{ borderTop: `1px solid ${colors.line}`, padding: '12px 0' }}
        >
          <Text style={{ ...paragraph, margin: 0 }}>
            {item.actorName ?? 'Someone'} {VERB[item.kind]}{' '}
            <a href={item.url} style={{ color: colors.ink, fontWeight: 600 }}>
              {item.identifier} {item.title}
            </a>
          </Text>
          {item.excerpt && (
            <Text style={{ ...paragraph, color: colors.muted, fontSize: 13, margin: '4px 0 0' }}>
              “{item.excerpt}”
            </Text>
          )}
        </Section>
      ))}
      {more > 0 && (
        <Text style={{ ...paragraph, color: colors.muted, fontSize: 13 }}>And {more} more.</Text>
      )}
      <Button
        href={inboxUrl}
        style={{
          backgroundColor: colors.ink,
          borderRadius: 6,
          color: colors.canvas,
          display: 'inline-block',
          fontSize: 14,
          fontWeight: 600,
          marginTop: 8,
          padding: '10px 16px',
        }}
      >
        Open your inbox
      </Button>
    </Layout>
  );
}

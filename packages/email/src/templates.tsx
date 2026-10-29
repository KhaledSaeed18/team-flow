import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { ReactNode } from 'react';

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

function Layout({
  preview,
  title,
  children,
}: {
  preview: string;
  title: string;
  children: ReactNode;
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
          <Text style={{ color: colors.ink, fontSize: 14, fontWeight: 600, margin: '0 0 24px' }}>
            TeamFlow
          </Text>
          <Heading
            as="h1"
            style={{ color: colors.ink, fontSize: 20, fontWeight: 600, margin: '0 0 12px' }}
          >
            {title}
          </Heading>
          {children}
          <Hr style={{ borderColor: colors.line, margin: '28px 0 16px' }} />
          <Text style={{ color: colors.muted, fontSize: 12, margin: 0 }}>
            You are receiving this because of an action on your TeamFlow account. If it was not you,
            you can ignore it.
          </Text>
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

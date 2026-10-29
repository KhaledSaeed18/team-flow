import { createFileRoute } from '@tanstack/react-router';
import { Button, Notice, TextField } from '@teamflow/ui';
import { useState } from 'react';
import { Form } from 'react-aria-components';
import { z } from 'zod';
import { AuthLayout } from '../../components/auth-layout.tsx';
import { authClient } from '../../lib/auth.ts';
import { field, useSubmit } from '../../lib/use-submit.ts';

export const Route = createFileRoute('/_auth/verify')({
  validateSearch: z.object({ email: z.email() }),
  component: Verify,
});

function Verify() {
  const { email } = Route.useSearch();
  const [resent, setResent] = useState(false);
  const { onSubmit, pending, error } = useSubmit(async (data) => {
    const { error } = await authClient.emailOtp.verifyEmail({ email, otp: field(data, 'code') });
    if (error)
      return 'That code is wrong or has expired. Check the latest email, or send a new code.';
    window.location.assign('/');
  });

  const resend = async () => {
    await authClient.emailOtp.sendVerificationOtp({ email, type: 'email-verification' });
    setResent(true);
  };

  return (
    <AuthLayout
      title="Check your email"
      subtitle={
        <>
          Enter the six-digit code we sent to <strong className="text-ink">{email}</strong>.
        </>
      }
    >
      <Form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Notice tone="danger">{error}</Notice>}
        {resent && !error && <Notice>A new code is on its way.</Notice>}
        <TextField
          name="code"
          label="Code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6}"
          maxLength={6}
          isRequired
          autoFocus
        />
        <Button type="submit" variant="primary" size="lg" isPending={pending}>
          Verify email
        </Button>
        <Button variant="quiet" onPress={resend}>
          Send a new code
        </Button>
      </Form>
    </AuthLayout>
  );
}

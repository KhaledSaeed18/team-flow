import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button, Notice, TextField } from '@teamflow/ui';
import { Form } from 'react-aria-components';
import { z } from 'zod';
import { AuthLayout } from '../../components/auth-layout.tsx';
import { authClient } from '../../lib/auth.ts';
import { field, useSubmit } from '../../lib/use-submit.ts';

export const Route = createFileRoute('/_auth/reset-password')({
  validateSearch: z.object({ email: z.email() }),
  component: ResetPassword,
});

function ResetPassword() {
  const { email } = Route.useSearch();
  const navigate = useNavigate();
  const { onSubmit, pending, error } = useSubmit(async (data) => {
    const { error } = await authClient.emailOtp.resetPassword({
      email,
      otp: field(data, 'code'),
      password: String(data.get('password')),
    });
    if (error) return 'That code is wrong or has expired. Request a new one.';
    await navigate({ to: '/sign-in' });
  });

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle={
        <>
          Enter the code sent to <strong className="text-ink">{email}</strong>.
        </>
      }
    >
      <Form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Notice tone="danger">{error}</Notice>}
        <TextField
          name="code"
          label="Code"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          isRequired
          autoFocus
        />
        <TextField
          name="password"
          type="password"
          label="New password"
          autoComplete="new-password"
          description="At least 10 characters."
          minLength={10}
          isRequired
        />
        <Button type="submit" variant="primary" size="lg" isPending={pending}>
          Set new password
        </Button>
      </Form>
    </AuthLayout>
  );
}

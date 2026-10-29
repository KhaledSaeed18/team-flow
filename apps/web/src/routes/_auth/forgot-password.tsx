import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button, Notice, TextField, TextLink } from '@teamflow/ui';
import { Form } from 'react-aria-components';
import { AuthLayout } from '../../components/auth-layout.tsx';
import { authClient } from '../../lib/auth.ts';
import { field, useSubmit } from '../../lib/use-submit.ts';

export const Route = createFileRoute('/_auth/forgot-password')({ component: ForgotPassword });

function ForgotPassword() {
  const navigate = useNavigate();
  const { onSubmit, pending, error } = useSubmit(async (data) => {
    const email = field(data, 'email');
    const { error } = await authClient.emailOtp.sendVerificationOtp({
      email,
      type: 'forget-password',
    });
    if (error) return error.message;
    await navigate({ to: '/reset-password', search: { email } });
  });

  return (
    <AuthLayout title="Reset your password" subtitle="We will email you a code to set a new one.">
      <Form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Notice tone="danger">{error}</Notice>}
        <TextField
          name="email"
          type="email"
          label="Email"
          autoComplete="email"
          isRequired
          autoFocus
        />
        <Button type="submit" variant="primary" size="lg" isPending={pending}>
          Email me a code
        </Button>
        <TextLink href="/sign-in" className="text-sm">
          Back to sign in
        </TextLink>
      </Form>
    </AuthLayout>
  );
}

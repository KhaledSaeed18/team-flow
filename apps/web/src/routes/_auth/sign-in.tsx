import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button, Notice, TextField, TextLink } from '@teamflow/ui';
import { Form } from 'react-aria-components';
import { z } from 'zod';
import { AuthLayout } from '../../components/auth-layout.tsx';
import { authClient } from '../../lib/auth.ts';
import { field, useSubmit } from '../../lib/use-submit.ts';

export const Route = createFileRoute('/_auth/sign-in')({
  validateSearch: z.object({ redirect: z.string().startsWith('/').optional() }),
  component: SignIn,
});

function SignIn() {
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();
  const { onSubmit, pending, error } = useSubmit(async (data) => {
    const email = field(data, 'email');
    const { error } = await authClient.signIn.email({
      email,
      password: String(data.get('password')),
    });
    if (error?.code === 'EMAIL_NOT_VERIFIED') {
      await authClient.emailOtp.sendVerificationOtp({ email, type: 'email-verification' });
      await navigate({ to: '/verify', search: { email, redirect } });
      return;
    }
    if (error)
      return error.status === 401 ? 'That email and password do not match.' : error.message;
    window.location.assign(redirect ?? '/');
  });

  return (
    <AuthLayout title="Sign in to TeamFlow" subtitle="Pick up where your team left off.">
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
        <TextField
          name="password"
          type="password"
          label="Password"
          autoComplete="current-password"
          isRequired
        />
        <Button type="submit" variant="primary" size="lg" isPending={pending}>
          Sign in
        </Button>
        <div className="flex justify-between text-sm">
          <TextLink href="/forgot-password">Forgot password?</TextLink>
          <TextLink href="/sign-up">Create an account</TextLink>
        </div>
      </Form>
    </AuthLayout>
  );
}

import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { Button, Notice, TextField, TextLink } from '@teamflow/ui';
import { Form } from 'react-aria-components';
import { AuthLayout } from '../../components/auth-layout.tsx';
import { authClient } from '../../lib/auth.ts';
import { field, useSubmit } from '../../lib/use-submit.ts';

export const Route = createFileRoute('/_auth/sign-up')({ component: SignUp });

function SignUp() {
  const navigate = useNavigate();
  const { onSubmit, pending, error } = useSubmit(async (data) => {
    const email = field(data, 'email');
    const { error } = await authClient.signUp.email({
      name: field(data, 'name'),
      email,
      password: String(data.get('password')),
    });
    if (error) return error.message;
    await navigate({ to: '/verify', search: { email } });
  });

  return (
    <AuthLayout
      title="Create your account"
      subtitle="We will email you a six-digit code to confirm it is you."
    >
      <Form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Notice tone="danger">{error}</Notice>}
        <TextField name="name" label="Name" autoComplete="name" isRequired autoFocus />
        <TextField name="email" type="email" label="Work email" autoComplete="email" isRequired />
        <TextField
          name="password"
          type="password"
          label="Password"
          autoComplete="new-password"
          description="At least 10 characters."
          minLength={10}
          isRequired
        />
        <Button type="submit" variant="primary" size="lg" isPending={pending}>
          Create account
        </Button>
        <p className="text-ink-muted text-sm">
          Already have an account? <TextLink href="/sign-in">Sign in</TextLink>
        </p>
      </Form>
    </AuthLayout>
  );
}

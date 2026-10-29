import { createFileRoute, redirect } from '@tanstack/react-router';
import { Button, Notice, TextField } from '@teamflow/ui';
import { useState } from 'react';
import { Form } from 'react-aria-components';
import { AuthLayout } from '../components/auth-layout.tsx';
import { authClient } from '../lib/auth.ts';
import { loadMe } from '../lib/session.ts';
import { field, useSubmit } from '../lib/use-submit.ts';

export const Route = createFileRoute('/onboarding')({
  beforeLoad: async ({ context }) => {
    if (!(await loadMe(context.queryClient))) throw redirect({ to: '/sign-in' });
  },
  component: Onboarding,
});

const slugify = (name: string) =>
  name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

function Onboarding() {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);

  const { onSubmit, pending, error } = useSubmit(async (data) => {
    const { data: org, error } = await authClient.organization.create({
      name: field(data, 'name'),
      slug: field(data, 'slug'),
    });
    if (error)
      return error.code === 'ORGANIZATION_ALREADY_EXISTS'
        ? 'That address is taken. Try another.'
        : error.message;
    await authClient.organization.setActive({ organizationId: org.id });
    window.location.assign('/');
  });

  return (
    <AuthLayout
      title="Name your workspace"
      subtitle="A workspace holds your team’s projects. You can invite people next."
    >
      <Form onSubmit={onSubmit} className="flex flex-col gap-4">
        {error && <Notice tone="danger">{error}</Notice>}
        <TextField
          name="name"
          label="Workspace name"
          value={name}
          onChange={(value) => {
            setName(value);
            if (!slugEdited) setSlug(slugify(value));
          }}
          isRequired
          autoFocus
        />
        <TextField
          name="slug"
          label="Workspace address"
          description="Lowercase letters, numbers and dashes."
          value={slug}
          onChange={(value) => {
            setSlug(value);
            setSlugEdited(true);
          }}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          isRequired
        />
        <Button type="submit" variant="primary" size="lg" isPending={pending}>
          Create workspace
        </Button>
      </Form>
    </AuthLayout>
  );
}

import { useQuery } from '@tanstack/react-query';
import { createFileRoute, redirect } from '@tanstack/react-router';
import { Button, Notice, Spinner } from '@teamflow/ui';
import { useState } from 'react';
import { AuthLayout } from '../../components/auth-layout.tsx';
import { authClient } from '../../lib/auth.ts';
import { loadMe } from '../../lib/session.ts';

/** Where invitation emails land. Signed-out visitors sign in (or up) first and come back here. */
export const Route = createFileRoute('/invitations/$invitationId')({
  beforeLoad: async ({ context, location }) => {
    if (!(await loadMe(context.queryClient)))
      throw redirect({ to: '/sign-up', search: { redirect: location.href } });
  },
  component: Invitation,
});

function Invitation() {
  const { invitationId } = Route.useParams();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const invitation = useQuery({
    queryKey: ['invitation', invitationId],
    queryFn: async () => {
      const { data, error } = await authClient.organization.getInvitation({
        query: { id: invitationId },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    retry: false,
  });

  if (invitation.isPending)
    return (
      <AuthLayout title="Invitation">
        <Spinner />
      </AuthLayout>
    );
  if (invitation.isError || !invitation.data) {
    return (
      <AuthLayout
        title="This invitation cannot be used"
        subtitle="It may have expired, been canceled, or been sent to a different email address than the one you are signed in with."
      >
        <Button variant="secondary" onPress={() => window.location.assign('/')}>
          Go to TeamFlow
        </Button>
      </AuthLayout>
    );
  }

  const { organizationName, inviterEmail, role } = invitation.data;
  const respond = async (accept: boolean) => {
    setPending(true);
    const { error } = accept
      ? await authClient.organization.acceptInvitation({ invitationId })
      : await authClient.organization.rejectInvitation({ invitationId });
    if (error) {
      setPending(false);
      setError(error.message ?? 'That did not work. Try again.');
      return;
    }
    if (accept)
      await authClient.organization.setActive({ organizationId: invitation.data.organizationId });
    window.location.assign('/');
  };

  return (
    <AuthLayout
      title={`Join ${organizationName}`}
      subtitle={`${inviterEmail} invited you to join as ${role === 'admin' ? 'an admin' : `a ${role}`}.`}
    >
      {error && (
        <Notice tone="danger" className="mb-4">
          {error}
        </Notice>
      )}
      <div className="flex gap-2">
        <Button variant="primary" size="lg" isPending={pending} onPress={() => respond(true)}>
          Join {organizationName}
        </Button>
        <Button variant="quiet" size="lg" isDisabled={pending} onPress={() => respond(false)}>
          Decline
        </Button>
      </div>
    </AuthLayout>
  );
}

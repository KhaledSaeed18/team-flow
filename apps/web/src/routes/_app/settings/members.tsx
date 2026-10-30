import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { can, canAssignRole, isRole, type Role } from '@teamflow/auth/permissions';
import { Avatar, Button, Dialog, Notice, Select, SelectItem, TextField, toast } from '@teamflow/ui';
import { useState } from 'react';
import { Form } from 'react-aria-components';
import { orpc } from '../../../lib/api.ts';
import { authClient } from '../../../lib/auth.ts';

export const Route = createFileRoute('/_app/settings/members')({ component: Members });

const ROLE_LABEL: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  guest: 'Guest',
};
const ROLE_HELP: Record<Role, string> = {
  owner: 'Everything, including deleting the workspace.',
  admin: 'Manages people, workflows and settings.',
  member: 'Creates and edits projects, tasks and sprints.',
  guest: 'Reads everything and comments.',
};
const ASSIGNABLE: Role[] = ['admin', 'member', 'guest'];

function Members() {
  const { me } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const myRole = me.organizations.find((o) => o.id === me.activeOrganizationId)?.role ?? 'guest';
  const role: Role = isRole(myRole) ? myRole : 'guest';
  const members = useQuery(orpc.members.list.queryOptions());
  const invitations = useQuery({
    queryKey: ['invitations', me.activeOrganizationId],
    queryFn: async () => (await authClient.organization.listInvitations()).data ?? [],
  });
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: orpc.members.key() }),
      queryClient.invalidateQueries({ queryKey: ['invitations'] }),
    ]);

  const [removing, setRemoving] = useState<{ id: string; name: string } | null>(null);
  const [removingPending, setRemovingPending] = useState(false);
  const remove = async (member: { id: string; name: string }) => {
    setRemovingPending(true);
    const { error } = await authClient.organization.removeMember({ memberIdOrEmail: member.id });
    setRemovingPending(false);
    setRemoving(null);
    if (error) toast({ title: 'Not removed', description: error.message, tone: 'danger' });
    else toast({ title: `${member.name} was removed` });
    await refresh();
  };

  const canInvite = can(role, { invitation: ['create'] });
  const canManage = can(role, { member: ['update'] });

  return (
    <main className="w-full p-4">
      <h1 className="font-semibold text-xl">Members</h1>
      <p className="mt-1 text-ink-muted text-sm">People in this workspace and what they can do.</p>

      {canInvite && <InviteForm onInvited={refresh} />}

      <section aria-labelledby="people" className="mt-8">
        <h2 id="people" className="mb-2 font-medium text-sm">
          People
        </h2>
        <ul className="divide-y divide-line rounded-card border border-line bg-surface">
          {members.data?.map((member) => {
            const memberRole: Role = isRole(member.role) ? member.role : 'guest';
            const self = member.userId === me.user.id;
            const editable =
              canManage && !self && memberRole !== 'owner' && canAssignRole(role, memberRole);
            return (
              <li key={member.id} className="flex items-center gap-3 px-4 py-3">
                <Avatar name={member.name} src={member.image} size="md" decorative />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-sm">
                    {member.name}{' '}
                    {self && <span className="font-normal text-ink-faint">(you)</span>}
                  </p>
                  <p className="truncate text-ink-muted text-xs">{member.email}</p>
                </div>
                {editable ? (
                  <>
                    <div className="w-32">
                      <Select
                        aria-label={`Role for ${member.name}`}
                        selectedKey={memberRole}
                        onSelectionChange={async (key) => {
                          const { error } = await authClient.organization.updateMemberRole({
                            memberId: member.id,
                            role: String(key) as Role,
                          });
                          if (error)
                            toast({
                              title: 'Role not changed',
                              description: error.message,
                              tone: 'danger',
                            });
                          await refresh();
                        }}
                      >
                        {ASSIGNABLE.filter((r) => canAssignRole(role, r)).map((r) => (
                          <SelectItem key={r} id={r}>
                            {ROLE_LABEL[r]}
                          </SelectItem>
                        ))}
                      </Select>
                    </div>
                    <Button
                      variant="quiet"
                      size="sm"
                      aria-label={`Remove ${member.name}`}
                      onPress={() => setRemoving({ id: member.id, name: member.name })}
                    >
                      Remove
                    </Button>
                  </>
                ) : (
                  <span className="text-ink-muted text-sm">{ROLE_LABEL[memberRole]}</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {(invitations.data ?? []).some((i) => i.status === 'pending') && (
        <section aria-labelledby="pending" className="mt-8">
          <h2 id="pending" className="mb-2 font-medium text-sm">
            Pending invitations
          </h2>
          <ul className="divide-y divide-line rounded-card border border-line bg-surface">
            {invitations.data
              ?.filter((i) => i.status === 'pending')
              .map((invitation) => (
                <li key={invitation.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                  <span className="flex-1 truncate">{invitation.email}</span>
                  <span className="text-ink-muted">
                    {ROLE_LABEL[(invitation.role ?? 'member') as Role] ?? invitation.role}
                  </span>
                  {can(role, { invitation: ['cancel'] }) && (
                    <Button
                      variant="quiet"
                      size="sm"
                      aria-label={`Cancel the invitation for ${invitation.email}`}
                      onPress={async () => {
                        await authClient.organization.cancelInvitation({
                          invitationId: invitation.id,
                        });
                        await refresh();
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </li>
              ))}
          </ul>
        </section>
      )}
      {removing && (
        <Dialog
          isOpen
          onOpenChange={(open) => !open && setRemoving(null)}
          title={`Remove ${removing.name}?`}
          width="sm"
        >
          <p className="text-ink-muted text-sm">
            They lose access to every project in this workspace at once. Their tasks, comments and
            history stay. You can invite them again later.
          </p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="quiet" onPress={() => setRemoving(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              isPending={removingPending}
              onPress={() => void remove(removing)}
            >
              Remove
            </Button>
          </div>
        </Dialog>
      )}
    </main>
  );
}

function InviteForm({ onInvited }: { onInvited: () => Promise<unknown> }) {
  const [role, setRole] = useState<Role>('member');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <Form
      className="mt-6 rounded-card border border-line bg-surface p-4"
      onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        setError(null);
        const { error } = await authClient.organization.inviteMember({ email: email.trim(), role });
        setPending(false);
        if (error) {
          setError(error.message ?? 'The invitation was not sent.');
          return;
        }
        toast({ title: `Invitation sent to ${email.trim()}` });
        setEmail('');
        await onInvited();
      }}
    >
      <div className="flex flex-wrap items-end gap-3">
        <TextField
          label="Invite by email"
          type="email"
          value={email}
          onChange={setEmail}
          placeholder="name@company.com"
          isRequired
          className="min-w-56 flex-1"
        />
        <div className="w-36">
          <Select
            label="Role"
            selectedKey={role}
            onSelectionChange={(key) => setRole(String(key) as Role)}
          >
            {ASSIGNABLE.map((r) => (
              <SelectItem key={r} id={r}>
                {ROLE_LABEL[r]}
              </SelectItem>
            ))}
          </Select>
        </div>
        <Button type="submit" variant="primary" isPending={pending}>
          Send invitation
        </Button>
      </div>
      <p className="mt-2 text-ink-muted text-xs">{ROLE_HELP[role]}</p>
      {error && (
        <Notice tone="danger" className="mt-3">
          {error}
        </Notice>
      )}
    </Form>
  );
}

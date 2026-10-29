import { Desktop } from '@phosphor-icons/react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { Avatar, Button, Notice, Switch, TextField, toast } from '@teamflow/ui';
import { useRef, useState } from 'react';
import { Form } from 'react-aria-components';
import { authClient } from '../../../lib/auth.ts';
import { describeDevice } from '../../../lib/device.ts';
import { meQuery } from '../../../lib/session.ts';
import { field, useSubmit } from '../../../lib/use-submit.ts';

export const Route = createFileRoute('/_app/settings/account')({ component: Account });

function Account() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-10 p-8">
      <div>
        <h1 className="font-semibold text-xl">Account</h1>
        <p className="mt-1 text-ink-muted text-sm">
          Your profile, password and where you are signed in.
        </p>
      </div>
      <Profile />
      <Password />
      <Sessions />
    </main>
  );
}

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="font-medium text-sm">
        {title}
      </h2>
      {children}
    </section>
  );
}

function Profile() {
  const { me } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const { onSubmit, pending, error } = useSubmit(async (data) => {
    const name = field(data, 'name');
    const { error } = await authClient.updateUser({ name });
    if (error) return error.message ?? 'Your name was not saved.';
    // The name appears in members, comments and history, so refresh everything.
    await queryClient.invalidateQueries();
    toast({ title: 'Profile saved' });
  });

  return (
    <Section id="profile" title="Profile">
      <Form
        onSubmit={onSubmit}
        className="flex items-end gap-4 rounded-card border border-line bg-surface p-4"
      >
        <Avatar name={me.user.name} src={me.user.image} size="lg" />
        <TextField
          name="name"
          label="Name"
          defaultValue={me.user.name}
          maxLength={80}
          isRequired
          className="flex-1"
        />
        <TextField label="Email" value={me.user.email} isReadOnly className="flex-1" />
        <Button type="submit" isPending={pending}>
          Save
        </Button>
      </Form>
      {error && <Notice tone="danger">{error}</Notice>}
    </Section>
  );
}

function Password() {
  const queryClient = useQueryClient();
  const [signOutOthers, setSignOutOthers] = useState(true);
  const form = useRef<HTMLFormElement>(null);
  const { onSubmit, pending, error } = useSubmit(async (data) => {
    const { error } = await authClient.changePassword({
      currentPassword: String(data.get('current') ?? ''),
      newPassword: String(data.get('next') ?? ''),
      revokeOtherSessions: signOutOthers,
    });
    if (error) {
      return error.code === 'INVALID_PASSWORD'
        ? 'Your current password is not right.'
        : (error.message ?? 'Your password was not changed.');
    }
    form.current?.reset();
    void queryClient.invalidateQueries({ queryKey: ['sessions'] });
    toast({ title: 'Password changed' });
    return null;
  });

  return (
    <Section id="password" title="Password">
      <Form
        ref={form}
        onSubmit={onSubmit}
        className="flex flex-col gap-4 rounded-card border border-line bg-surface p-4"
      >
        {error && <Notice tone="danger">{error}</Notice>}
        <div className="grid grid-cols-2 gap-4">
          <TextField
            name="current"
            type="password"
            label="Current password"
            autoComplete="current-password"
            isRequired
          />
          <TextField
            name="next"
            type="password"
            label="New password"
            autoComplete="new-password"
            description="At least 10 characters."
            minLength={10}
            isRequired
          />
        </div>
        <div className="flex items-center justify-between gap-4">
          <Switch isSelected={signOutOthers} onChange={setSignOutOthers}>
            Sign out of other devices
          </Switch>
          <Button type="submit" isPending={pending}>
            Change password
          </Button>
        </div>
      </Form>
    </Section>
  );
}

function Sessions() {
  const queryClient = useQueryClient();
  const me = useQuery(meQuery());
  const current = useQuery({
    queryKey: ['sessions', 'current'],
    queryFn: async () => (await authClient.getSession()).data?.session.token ?? null,
  });
  const sessions = useQuery({
    queryKey: ['sessions', me.data?.user.id],
    queryFn: async () => {
      const { data, error } = await authClient.listSessions();
      if (error) throw new Error(error.message);
      return [...data].sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    },
  });
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['sessions'] });
  const revoke = async (token: string) => {
    const { error } = await authClient.revokeSession({ token });
    if (error) toast({ title: 'Not signed out', description: error.message, tone: 'danger' });
    await refresh();
  };
  const revokeOthers = async () => {
    const { error } = await authClient.revokeOtherSessions();
    if (error) toast({ title: 'Not signed out', description: error.message, tone: 'danger' });
    await refresh();
  };
  const others = (sessions.data ?? []).filter((s) => s.token !== current.data);

  return (
    <Section id="sessions" title="Where you are signed in">
      <ul className="divide-y divide-line rounded-card border border-line bg-surface">
        {(sessions.data ?? []).map((session) => {
          const here = session.token === current.data;
          const device = describeDevice(session.userAgent);
          return (
            <li key={session.id} className="flex items-center gap-3 px-4 py-3">
              <Desktop aria-hidden className="shrink-0 text-ink-faint" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm">
                  {device}
                  {here && (
                    <span className="ml-2 rounded-full bg-raised px-2 py-0.5 text-ink-muted text-xs">
                      This device
                    </span>
                  )}
                </p>
                <p className="truncate text-ink-faint text-xs">
                  {session.ipAddress ? `${session.ipAddress} · ` : ''}
                  Signed in {new Date(session.createdAt).toLocaleDateString()} · last active{' '}
                  {new Date(session.updatedAt).toLocaleString()}
                </p>
              </div>
              {!here && (
                <Button
                  variant="quiet"
                  size="sm"
                  aria-label={`Sign out ${device}, signed in ${new Date(session.createdAt).toLocaleString()}`}
                  onPress={() => revoke(session.token)}
                >
                  Sign out
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      {others.length > 0 && (
        <Button variant="quiet" size="sm" className="self-start" onPress={revokeOthers}>
          Sign out of all other devices
        </Button>
      )}
    </Section>
  );
}

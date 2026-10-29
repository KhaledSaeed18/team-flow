import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { authClient } from '../lib/auth.ts';
import { loadMe, meQuery } from '../lib/session.ts';

/**
 * Everything behind sign-in. Ensures there is an active organization: picks the first one the user belongs to,
 * or sends them to create one.
 */
export const Route = createFileRoute('/_app')({
  beforeLoad: async ({ context, location }) => {
    const me = await loadMe(context.queryClient);
    if (!me) throw redirect({ to: '/sign-in', search: { redirect: location.href } });

    if (!me.activeOrganizationId) {
      const first = me.organizations[0];
      if (!first) throw redirect({ to: '/onboarding' });
      await authClient.organization.setActive({ organizationId: first.id });
      await context.queryClient.invalidateQueries({ queryKey: meQuery().queryKey });
      return { me: await context.queryClient.fetchQuery(meQuery()) };
    }
    return { me };
  },
  component: Outlet,
});

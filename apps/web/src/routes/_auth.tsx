import { createFileRoute, Outlet, redirect } from '@tanstack/react-router';
import { loadMe } from '../lib/session.ts';

/** Screens for signed-out visitors; a signed-in user is sent to the app. */
export const Route = createFileRoute('/_auth')({
  beforeLoad: async ({ context }) => {
    if (await loadMe(context.queryClient)) throw redirect({ to: '/' });
  },
  component: Outlet,
});

import { listUserOrganizations, workspacesWithProject } from '@teamflow/db';
import { authed, os } from '../orpc.ts';

export const me = {
  get: os.me.get.use(authed).handler(async ({ context }) => {
    const { user, session } = context.session;
    const organizations = await listUserOrganizations(context.db, user.id);
    // A token is pinned to one workspace (its session's active one) and reveals nothing about the others.
    const visible = context.token
      ? organizations.filter((o) => o.id === session.activeOrganizationId)
      : organizations;
    return {
      user: { id: user.id, name: user.name, email: user.email, image: user.image ?? null },
      activeOrganizationId: session.activeOrganizationId ?? null,
      organizations: visible,
    };
  }),

  locateProject: os.me.locateProject.use(authed).handler(async ({ context, input }) => {
    const found = await workspacesWithProject(context.db, context.session.user.id, input.key);
    // A token is pinned to one workspace and learns nothing about the others.
    const visible = context.token
      ? found.filter((o) => o.id === context.session.session.activeOrganizationId)
      : found;
    return { organizations: visible };
  }),
};

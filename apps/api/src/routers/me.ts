import { listUserOrganizations } from '@teamflow/db';
import { authed, os } from '../orpc.ts';

export const me = {
  get: os.me.get.use(authed).handler(async ({ context }) => {
    const { user, session } = context.session;
    return {
      user: { id: user.id, name: user.name, email: user.email, image: user.image ?? null },
      activeOrganizationId: session.activeOrganizationId ?? null,
      organizations: await listUserOrganizations(context.db, user.id),
    };
  }),
};

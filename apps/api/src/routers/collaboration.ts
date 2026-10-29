import { os, tenant } from '../orpc.ts';
import { commentsService, notificationsService } from '../services/collaboration.ts';

export const comments = {
  list: os.comments.list
    .use(tenant)
    .handler(({ context, input }) => commentsService.list(context, input.taskId)),
  create: os.comments.create
    .use(tenant)
    .handler(({ context, input }) => commentsService.create(context, input, context.clock.now())),
  update: os.comments.update
    .use(tenant)
    .handler(({ context, input }) =>
      commentsService.update(
        context,
        input.id,
        { body: input.body, mentions: input.mentions },
        context.clock.now(),
      ),
    ),
  react: os.comments.react
    .use(tenant)
    .handler(({ context, input }) => commentsService.react(context, input)),
  delete: os.comments.delete
    .use(tenant)
    .handler(({ context, input }) =>
      commentsService.delete(context, input.id, context.clock.now()),
    ),
};

export const notifications = {
  digest: os.notifications.digest
    .use(tenant)
    .handler(({ context }) => notificationsService.digest(context)),
  setDigest: os.notifications.setDigest
    .use(tenant)
    .handler(({ context, input }) => notificationsService.setDigest(context, input.frequency)),
  list: os.notifications.list
    .use(tenant)
    .handler(({ context, input }) => notificationsService.list(context, input.unreadOnly)),
  markRead: os.notifications.markRead
    .use(tenant)
    .handler(({ context, input }) =>
      notificationsService.markRead(context, input.ids, context.clock.now()),
    ),
};

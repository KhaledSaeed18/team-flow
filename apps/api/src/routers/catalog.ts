import { os, tenant } from '../orpc.ts';
import { labelsService, membersService, workflowService } from '../services/catalog.ts';
import { withoutUndefined } from './util.ts';

export const members = {
  list: os.members.list.use(tenant).handler(({ context }) => membersService.list(context)),
};

export const labels = {
  list: os.labels.list
    .use(tenant)
    .handler(({ context, input }) => labelsService.list(context, input.projectId)),
  create: os.labels.create
    .use(tenant)
    .handler(({ context, input }) => labelsService.create(context, input)),
  update: os.labels.update.use(tenant).handler(({ context, input }) => {
    const { id, ...patch } = input;
    return labelsService.update(context, id, withoutUndefined(patch));
  }),
  delete: os.labels.delete
    .use(tenant)
    .handler(({ context, input }) => labelsService.delete(context, input.id)),
};

export const workflow = {
  createStatus: os.workflow.createStatus
    .use(tenant)
    .handler(({ context, input }) => workflowService.createStatus(context, input)),
  updateStatus: os.workflow.updateStatus.use(tenant).handler(({ context, input }) => {
    const { id, ...patch } = input;
    return workflowService.updateStatus(context, id, withoutUndefined(patch));
  }),
  deleteStatus: os.workflow.deleteStatus
    .use(tenant)
    .handler(({ context, input }) =>
      workflowService.deleteStatus(context, input.id, input.moveTasksTo, context.clock.now()),
    ),
};

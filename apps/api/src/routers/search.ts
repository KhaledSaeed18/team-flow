import { searchTasks } from '@teamflow/db';
import type { StatusCategory } from '@teamflow/domain';
import { taskIdentifier } from '@teamflow/domain';
import { os, tenant } from '../orpc.ts';

export const search = {
  tasks: os.search.tasks.use(tenant).handler(async ({ context, input }) =>
    (await searchTasks(context.scope, input.q, input.limit)).map((hit) => ({
      id: hit.id,
      identifier: taskIdentifier(hit.project_key, hit.number),
      title: hit.title,
      projectId: hit.project_id,
      projectKey: hit.project_key,
      projectName: hit.project_name,
      projectColor: hit.project_color,
      statusName: hit.status_name,
      statusCategory: hit.status_category as StatusCategory,
      commentExcerpt: hit.comment_excerpt,
    })),
  ),
};

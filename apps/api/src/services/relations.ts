import { addRelation, findRelation, findTask, listRelations, removeRelation } from '@teamflow/db';
import { notFound } from '../errors.ts';
import { type Actor, authorize } from './actor.ts';

type Kind = 'blocks' | 'blocked_by' | 'relates' | 'duplicates';

export const relationsService = {
  async list(actor: Actor, taskId: string) {
    if (!(await findTask(actor.scope, taskId))) throw notFound('Task not found.');
    return listRelations(actor.scope, taskId);
  },

  async add(actor: Actor, input: { taskId: string; kind: Kind; otherTaskId: string }, now: Date) {
    if (!(await findTask(actor.scope, input.taskId))) throw notFound('Task not found.');
    authorize(actor, { task: ['update'] });
    const [sourceTaskId, targetTaskId] =
      input.kind === 'blocked_by'
        ? [input.otherTaskId, input.taskId]
        : [input.taskId, input.otherTaskId];
    const type = input.kind === 'blocked_by' ? 'blocks' : input.kind;
    const relation = await addRelation(actor.scope, { sourceTaskId, targetTaskId, type }, now);
    if (!relation) throw notFound('Task not found.');
    return { id: relation.id };
  },

  async remove(actor: Actor, id: string, now: Date) {
    if (!(await findRelation(actor.scope, id))) throw notFound('Relation not found.');
    authorize(actor, { task: ['update'] });
    await removeRelation(actor.scope, id, now);
    return { id };
  },
};

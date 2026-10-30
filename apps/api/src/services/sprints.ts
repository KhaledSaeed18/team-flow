import {
  completedSprints,
  completeSprint,
  createSprint,
  findSprint,
  listSprints,
  listTasks,
  type SprintRow,
  sprintChanges,
  startSprint,
  uniqueViolation,
  updateSprint,
} from '@teamflow/db';
import { burndown, cumulativeFlow, cycleTimes, median, velocity } from '@teamflow/domain';
import { AppError, notFound } from '../errors.ts';
import { type Actor, authorize } from './actor.ts';
import { visibleProject, writableProject } from './projects-access.ts';

const toWire = ({ organizationId: _org, createdAt: _c, updatedAt: _u, ...sprint }: SprintRow) =>
  sprint;

async function load(actor: Actor, id: string) {
  const sprint = await findSprint(actor.scope, id);
  if (!sprint) throw notFound('Sprint not found.');
  return sprint;
}

const required = <T>(value: T | null): T => {
  if (value === null) throw notFound('Sprint not found.');
  return value;
};

export const sprintsService = {
  async list(actor: Actor, projectId: string) {
    await visibleProject(actor, projectId);
    return (await listSprints(actor.scope, projectId)).map(toWire);
  },

  async create(
    actor: Actor,
    input: {
      projectId: string;
      name: string;
      goal?: string | undefined;
      startsAt: Date;
      endsAt: Date;
    },
  ) {
    authorize(actor, { sprint: ['create'] });
    await writableProject(actor, input.projectId);
    const { goal, ...rest } = input;
    return toWire(
      await createSprint(actor.scope, { ...rest, ...(goal !== undefined ? { goal } : {}) }),
    );
  },

  async update(
    actor: Actor,
    id: string,
    version: number,
    patch: { name?: string; goal?: string; startsAt?: Date; endsAt?: Date },
  ) {
    const sprint = await load(actor, id);
    authorize(actor, { sprint: ['update'] });
    await writableProject(actor, sprint.projectId);
    return toWire(required(await updateSprint(actor.scope, id, version, patch)));
  },

  async start(actor: Actor, id: string, version: number, now: Date) {
    const sprint = await load(actor, id);
    authorize(actor, { sprint: ['update'] });
    await writableProject(actor, sprint.projectId);
    try {
      return toWire(required(await startSprint(actor.scope, id, version, now)));
    } catch (error) {
      if (uniqueViolation(error)) {
        throw new AppError(
          'SPRINT_STATE',
          'Another sprint is already active in this project. Complete it first.',
        );
      }
      throw error;
    }
  },

  async complete(actor: Actor, id: string, version: number, carryOverTo: string | null, now: Date) {
    const sprint = await load(actor, id);
    authorize(actor, { sprint: ['update'] });
    await writableProject(actor, sprint.projectId);
    return toWire(required(await completeSprint(actor.scope, id, version, carryOverTo, now)));
  },

  async report(actor: Actor, id: string, now: Date) {
    const sprint = await load(actor, id);
    const startsAt = sprint.startedAt ?? sprint.startsAt;
    const endsAt = sprint.completedAt ?? sprint.endsAt;
    const changes = await sprintChanges(actor.scope, id);
    const result = burndown(id, changes, { startsAt, endsAt, now });
    const flow = cumulativeFlow(id, changes, { startsAt, endsAt, now });

    const finished = await completedSprints(actor.scope, sprint.projectId);
    const history = finished.map((s) => ({
      sprintId: s.id,
      name: s.name,
      committedPoints: s.committedPoints ?? 0,
      completedPoints: s.completedPoints ?? 0,
    }));

    const tasks = await listTasks(actor.scope, { projectId: sprint.projectId, sprintId: id });
    const cycle = median(
      cycleTimes(tasks, startsAt, new Date(Math.min(endsAt.getTime(), now.getTime()) + 1)),
    );

    return {
      sprint: toWire(sprint),
      ...result,
      flow,
      velocity: velocity(history),
      history,
      medianCycleTimeHours: cycle === null ? null : Math.round((cycle / 3_600_000) * 10) / 10,
    };
  },
};

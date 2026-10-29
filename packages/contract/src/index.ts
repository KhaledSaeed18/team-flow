import type {
  ContractRouterClient,
  InferContractRouterInputs,
  InferContractRouterOutputs,
} from '@orpc/contract';
import { labels } from './routers/labels.ts';
import { me } from './routers/me.ts';
import { members } from './routers/members.ts';
import { projects } from './routers/projects.ts';
import { tasks } from './routers/tasks.ts';
import { workflow } from './routers/workflow.ts';

export const contract = { me, members, projects, workflow, tasks, labels };

export type Contract = typeof contract;
export type Client = ContractRouterClient<Contract>;
export type Inputs = InferContractRouterInputs<Contract>;
export type Outputs = InferContractRouterOutputs<Contract>;

export { base } from './base.ts';
export * from './routers/labels.ts';
export * from './routers/members.ts';
export * from './routers/projects.ts';
export * from './routers/tasks.ts';
export * from './schemas.ts';

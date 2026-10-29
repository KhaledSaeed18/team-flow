import type {
  ContractRouterClient,
  InferContractRouterInputs,
  InferContractRouterOutputs,
} from '@orpc/contract';
import { me } from './routers/me.ts';
import { projects } from './routers/projects.ts';

export const contract = { me, projects };

export type Contract = typeof contract;
export type Client = ContractRouterClient<Contract>;
export type Inputs = InferContractRouterInputs<Contract>;
export type Outputs = InferContractRouterOutputs<Contract>;

export { base } from './base.ts';
export * from './routers/projects.ts';
export * from './schemas.ts';

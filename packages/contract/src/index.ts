import type {
  ContractRouterClient,
  InferContractRouterInputs,
  InferContractRouterOutputs,
} from '@orpc/contract';
import { me } from './routers/me.ts';

export const contract = { me };

export type Contract = typeof contract;
export type Client = ContractRouterClient<Contract>;
export type Inputs = InferContractRouterInputs<Contract>;
export type Outputs = InferContractRouterOutputs<Contract>;

export { base } from './base.ts';
export * from './schemas.ts';

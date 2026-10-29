import { os } from '../orpc.ts';
import { me } from './me.ts';

export const router = os.router({ me });

export type Router = typeof router;

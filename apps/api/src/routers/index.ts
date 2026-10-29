import { os } from '../orpc.ts';
import { me } from './me.ts';
import { projects } from './projects.ts';

export const router = os.router({ me, projects });

export type Router = typeof router;

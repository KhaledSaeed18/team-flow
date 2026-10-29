import { os } from '../orpc.ts';
import { me } from './me.ts';
import { projects } from './projects.ts';
import { tasks } from './tasks.ts';

export const router = os.router({ me, projects, tasks });

export type Router = typeof router;

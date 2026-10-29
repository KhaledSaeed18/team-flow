import { os } from '../orpc.ts';
import { labels, members, workflow } from './catalog.ts';
import { me } from './me.ts';
import { projects } from './projects.ts';
import { tasks } from './tasks.ts';

export const router = os.router({ me, members, projects, workflow, tasks, labels });

export type Router = typeof router;

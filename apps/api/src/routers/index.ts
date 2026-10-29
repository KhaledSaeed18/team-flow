import { os } from '../orpc.ts';
import { labels, members, workflow } from './catalog.ts';
import { comments, notifications } from './collaboration.ts';
import { me } from './me.ts';
import { projects } from './projects.ts';
import { search } from './search.ts';
import { sprints } from './sprints.ts';
import { tasks } from './tasks.ts';

export const router = os.router({
  me,
  members,
  projects,
  workflow,
  sprints,
  tasks,
  labels,
  comments,
  notifications,
  search,
});

export type Router = typeof router;

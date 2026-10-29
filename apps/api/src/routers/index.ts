import { os } from '../orpc.ts';
import { attachments } from './attachments.ts';
import { labels, members, workflow } from './catalog.ts';
import { comments, notifications } from './collaboration.ts';
import { me } from './me.ts';
import { projects } from './projects.ts';
import { relations } from './relations.ts';
import { search } from './search.ts';
import { sprints } from './sprints.ts';
import { tasks } from './tasks.ts';
import { views } from './views.ts';

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
  relations,
  attachments,
  views,
});

export type Router = typeof router;

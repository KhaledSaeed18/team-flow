import type { PresenceMember } from '@teamflow/realtime';
import { createContext, useContext } from 'react';
import type { Project } from './tasks.ts';

export interface ProjectView {
  /** The project with its workflow, kept fresh by live updates. */
  project: Project;
  /** Who has which task open right now (other people only). */
  viewersByTask: Map<string, PresenceMember[]>;
}

export const ProjectContext = createContext<ProjectView | null>(null);

export function useProjectView(): ProjectView {
  const view = useContext(ProjectContext);
  if (!view) throw new Error('useProjectView outside a project route');
  return view;
}

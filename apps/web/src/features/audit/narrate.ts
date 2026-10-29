import type { AuditEntry } from '@teamflow/contract';

const CATEGORY: Record<string, string> = {
  backlog: 'Backlog',
  unstarted: 'To do',
  started: 'In progress',
  completed: 'Done',
  canceled: 'Canceled',
};

const show = (value: unknown) => (value === null || value === undefined ? '' : String(value));
const quoted = (value: unknown) => `“${show(value)}”`;
const an = (role: unknown) =>
  show(role) === 'admin' || show(role) === 'owner' ? `an ${show(role)}` : `a ${show(role)}`;

/** One readable sentence for an audit entry, without the actor (shown separately). Unknown kinds still read. */
export function narrateAudit(entry: Pick<AuditEntry, 'kind' | 'changes' | 'project'>): string {
  const change = (field: string) => entry.changes.find((c) => c.field === field);
  const from = (field: string) => change(field)?.from;
  const to = (field: string) => change(field)?.to;
  const project = entry.project ? ` in ${entry.project.name}` : '';

  switch (entry.kind) {
    case 'member.invited':
      return `invited ${show(to('email'))} as ${an(to('role'))}`;
    case 'invitation.canceled':
      return `canceled the invitation for ${show(from('email'))}`;
    case 'member.joined':
      return `joined as ${an(to('role'))}`;
    case 'member.role_changed':
      return `changed ${show(from('member'))}’s role from ${show(from('role'))} to ${show(to('role'))}`;
    case 'member.removed':
      return `removed ${show(from('member'))} from the workspace`;
    case 'member.left':
      return `${show(from('member')) || 'Someone'} left the workspace`;
    case 'workspace.renamed':
      return `renamed the workspace from ${quoted(from('name'))} to ${quoted(to('name'))}`;

    case 'project.created':
      return `created the project ${entry.project?.name ?? ''}`.trim();
    case 'project.updated':
      return `updated the project ${entry.project?.name ?? ''}`.trim();
    case 'project.archived':
      return `archived the project ${entry.project?.name ?? ''}`.trim();
    case 'project.restored':
      return `restored the project ${entry.project?.name ?? ''}`.trim();

    case 'workflow.status_created':
      return `added the status ${quoted(to('status'))}${project}`;
    case 'workflow.status_deleted':
      return `deleted the status ${quoted(from('status'))}${project}, moving its tasks to ${quoted(to('movedTo'))}`;
    case 'workflow.status_updated': {
      const parts = [
        change('name') && `renamed it to ${quoted(to('name'))}`,
        change('category') && `made it ${CATEGORY[show(to('category'))] ?? show(to('category'))}`,
        change('color') && 'changed its color',
      ].filter(Boolean);
      return `changed the status ${quoted(from('status'))}${project}: ${parts.join(', ')}`;
    }

    case 'label.created':
      return `created the label ${quoted(to('label'))}${project}`;
    case 'label.deleted':
      return `deleted the label ${quoted(from('label'))}${project}`;
    case 'label.updated':
      return change('name')
        ? `renamed the label ${quoted(from('name'))} to ${quoted(to('name'))}${project}`
        : `recolored the label ${quoted(from('label'))}${project}`;

    case 'sprint.created':
      return `planned a sprint${project}`;
    case 'sprint.started':
      return `started a sprint${project}`;
    case 'sprint.completed':
      return `completed a sprint${project}`;
    case 'sprint.updated':
      return `edited a sprint${project}`;

    case 'token.created':
      return `created the ${to('access') === 'write' ? 'read and write' : 'read-only'} API token ${quoted(to('token'))}`;
    case 'token.revoked':
      return `revoked the API token ${quoted(from('token'))}`;

    default:
      return `${entry.kind.replace(/[._]/g, ' ')}${project}`;
  }
}

/** Entries that have no actor read as a whole sentence on their own. */
export const standsAlone = (kind: string) => kind === 'member.left';

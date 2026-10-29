import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { can, isRole } from '@teamflow/auth/permissions';
import { Button, Notice, TextField, toast } from '@teamflow/ui';
import { type ReactNode, useState } from 'react';
import { Form } from 'react-aria-components';
import { PROJECT_COLORS } from '../../../../components/create-project-dialog.tsx';
import { useProjectView } from '../../../../features/project-context.tsx';
import { LabelsEditor } from '../../../../features/settings/labels-editor.tsx';
import { ColorDot, WorkflowEditor } from '../../../../features/settings/workflow-editor.tsx';
import { orpc } from '../../../../lib/api.ts';

export const Route = createFileRoute('/_app/p/$key/settings')({ component: Settings });

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 border-line border-t py-8 md:grid-cols-[14rem_minmax(0,1fr)]">
      <div>
        <h2 className="font-medium text-sm">{title}</h2>
        <p className="mt-1 text-ink-muted text-xs leading-relaxed">{description}</p>
      </div>
      <div>{children}</div>
    </section>
  );
}

function Settings() {
  const { project } = useProjectView();
  const { me } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const myRole = me.organizations.find((o) => o.id === me.activeOrganizationId)?.role ?? 'guest';
  const role = isRole(myRole) ? myRole : 'guest';
  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.projects.key() });
  const failed = (title: string) => (error: Error) =>
    toast({ title, description: error.message, tone: 'danger' });

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const update = useMutation(
    orpc.projects.update.mutationOptions({
      onSuccess: async () => {
        await refresh();
        toast({ title: 'Project saved' });
      },
      onError: failed('Project not saved'),
    }),
  );
  const archive = useMutation(
    orpc.projects.archive.mutationOptions({
      onSuccess: async () => {
        await refresh();
        await navigate({ to: '/' });
      },
      onError: failed('Project not archived'),
    }),
  );
  const restore = useMutation(
    orpc.projects.restore.mutationOptions({
      onSuccess: refresh,
      onError: failed('Project not restored'),
    }),
  );

  const canEditProject = can(role, { project: ['update'] });
  return (
    <main className="mx-auto w-full max-w-4xl px-8 pb-16">
      <h1 className="pt-8 pb-6 font-semibold text-xl">Project settings</h1>
      {project.archivedAt && (
        <Notice className="mb-6">
          This project is archived: it is read-only and hidden from the sidebar.
        </Notice>
      )}

      <Section
        title="Details"
        description="The name and description everyone sees. The key prefixes task numbers and cannot change."
      >
        <Form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            update.mutate({ id: project.id, version: project.version, name, description });
          }}
        >
          <TextField
            label="Name"
            value={name}
            onChange={setName}
            isRequired
            isReadOnly={!canEditProject}
          />
          <TextField
            label="Key"
            value={project.key}
            isReadOnly
            description={`Tasks are numbered ${project.key}-1, ${project.key}-2 and so on.`}
          />
          <TextField
            label="Description"
            value={description}
            onChange={setDescription}
            multiline
            isReadOnly={!canEditProject}
          />
          <div className="flex items-center gap-3">
            <span className="font-medium text-sm">Color</span>
            <ColorDot
              color={project.color}
              label="Project color"
              disabled={!canEditProject}
              onChange={(color) =>
                update.mutate({ id: project.id, version: project.version, color })
              }
            />
            <span className="text-ink-faint text-xs">
              {PROJECT_COLORS.find(([c]) => c === project.color)?.[1]}
            </span>
          </div>
          {canEditProject && (
            <div>
              <Button type="submit" variant="primary" isPending={update.isPending}>
                Save details
              </Button>
            </div>
          )}
        </Form>
      </Section>

      <Section
        title="Workflow"
        description="The statuses tasks move through, in board order. Each has a type that drives the board, sprint reports and cycle time."
      >
        <WorkflowEditor project={project} canEdit={can(role, { workflow: ['update'] })} />
      </Section>

      <Section
        title="Labels"
        description="Tags for tasks. Workspace labels are shared by every project."
      >
        <LabelsEditor
          project={project}
          canCreate={can(role, { label: ['create'] })}
          canDelete={can(role, { label: ['delete'] })}
        />
      </Section>

      {can(role, { project: ['archive'] }) && (
        <Section
          title="Archive"
          description="Archiving keeps everything but makes the project read-only and hides it. You can restore it."
        >
          {project.archivedAt ? (
            <Button
              onPress={() => restore.mutate({ id: project.id, version: project.version })}
              isPending={restore.isPending}
            >
              Restore project
            </Button>
          ) : (
            <Button
              variant="danger"
              onPress={() => archive.mutate({ id: project.id, version: project.version })}
              isPending={archive.isPending}
            >
              Archive project
            </Button>
          )}
        </Section>
      )}
    </main>
  );
}

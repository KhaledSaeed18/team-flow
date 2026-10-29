import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createHarness, type Harness } from './harness.ts';

describe('audit log', () => {
  let h: Harness;
  let ada: Awaited<ReturnType<Harness['owner']>>;

  const kinds = async () => (await ada.client.audit.list()).entries.map((e) => e.kind);
  const latest = async () => (await ada.client.audit.list({ limit: 1 })).entries[0];

  beforeAll(async () => {
    h = await createHarness();
    ada = await h.owner('Ada');
  });
  afterAll(() => h.destroy());

  test('membership changes say who did what to whom', async () => {
    const linus = await h.join(ada, 'Linus', 'member');
    expect(await kinds()).toEqual(expect.arrayContaining(['member.invited', 'member.joined']));
    const invited = (await ada.client.audit.list()).entries.find(
      (e) => e.kind === 'member.invited',
    );
    expect(invited).toMatchObject({
      actorName: 'Ada',
      changes: [
        { field: 'email', to: linus.email },
        { field: 'role', to: 'member' },
      ],
    });

    const member = (await ada.client.members.list()).find((m) => m.name === 'Linus');
    await ada.authPost('/organization/update-member-role', { memberId: member?.id, role: 'admin' });
    expect(await latest()).toMatchObject({
      kind: 'member.role_changed',
      actorName: 'Ada',
      changes: [
        { field: 'member', from: 'Linus' },
        { field: 'role', from: 'member', to: 'admin' },
      ],
    });

    await ada.authPost('/organization/remove-member', { memberIdOrEmail: member?.id });
    expect(await latest()).toMatchObject({
      kind: 'member.removed',
      actorName: 'Ada',
      changes: [{ field: 'member', from: 'Linus', to: null }],
    });
  });

  test('someone leaving is recorded without an actor', async () => {
    const grace = await h.join(ada, 'Grace', 'member');
    await grace.authPost('/organization/leave', { organizationId: ada.organizationId });
    expect(await latest()).toMatchObject({
      kind: 'member.left',
      actorName: null,
      changes: [{ field: 'member', from: 'Grace' }],
    });
  });

  test('projects, workflows, labels and tokens appear; task edits do not', async () => {
    const project = await ada.client.projects.create({ key: 'AUD', name: 'Audit' });
    await ada.client.tasks.create({ projectId: project.id, title: 'Not in the audit log' });
    const status = await ada.client.workflow.createStatus({
      projectId: project.id,
      name: 'QA',
      category: 'started',
      color: '#64748b',
    });
    await ada.client.workflow.updateStatus({ id: status.id, name: 'Quality' });
    const label = await ada.client.labels.create({
      projectId: project.id,
      name: 'Bug',
      color: '#c2412d',
    });
    await ada.client.labels.update({ id: label.id, name: 'Defect' });
    const { token } = await ada.client.tokens.create({ name: 'CI', access: 'write' });
    await ada.client.tokens.revoke({ id: token.id });
    await ada.authPost('/organization/update', { data: { name: 'Ada Labs' } });

    const { entries } = await ada.client.audit.list({ limit: 8 });
    expect(entries.map((e) => e.kind)).toEqual([
      'workspace.renamed',
      'token.revoked',
      'token.created',
      'label.updated',
      'label.created',
      'workflow.status_updated',
      'workflow.status_created',
      'project.created',
    ]);
    expect(entries.find((e) => e.kind === 'workflow.status_updated')).toMatchObject({
      project: { key: 'AUD', name: 'Audit' },
      changes: [
        { field: 'status', from: 'QA' },
        { field: 'name', from: 'QA', to: 'Quality' },
      ],
    });
    expect(entries[0]?.changes).toEqual([{ field: 'name', from: "Ada's org", to: 'Ada Labs' }]);
  });

  test('pages backwards, and only admins may read it', async () => {
    const first = await ada.client.audit.list({ limit: 3 });
    expect(first.entries).toHaveLength(3);
    const second = await ada.client.audit.list({ limit: 3, before: first.nextBefore ?? undefined });
    expect(second.entries[0]?.id).not.toBe(first.entries[2]?.id);
    expect(new Set([...first.entries, ...second.entries].map((e) => e.id)).size).toBe(6);

    const member = await h.join(ada, 'Omar', 'member');
    await expect(member.client.audit.list()).rejects.toMatchObject({ code: 'FORBIDDEN' });
    const eve = await h.owner('Eve');
    expect((await eve.client.audit.list()).entries.map((e) => e.kind)).not.toContain(
      'member.removed',
    );
  });
});

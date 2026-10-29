/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import { narrateAudit } from './narrate.ts';

const entry = (
  kind: string,
  changes: { field: string; from?: unknown; to?: unknown }[],
  project = null as null | { key: string; name: string },
) => ({
  kind,
  project,
  changes: changes.map((c) => ({ from: null, to: null, ...c })),
});

describe('narrateAudit', () => {
  test('membership', () => {
    expect(
      narrateAudit(
        entry('member.invited', [
          { field: 'email', to: 'linus@example.com' },
          { field: 'role', to: 'admin' },
        ]),
      ),
    ).toBe('invited linus@example.com as an admin');
    expect(
      narrateAudit(
        entry('member.role_changed', [
          { field: 'member', from: 'Linus' },
          { field: 'role', from: 'member', to: 'guest' },
        ]),
      ),
    ).toBe('changed Linus’s role from member to guest');
    expect(narrateAudit(entry('member.left', [{ field: 'member', from: 'Grace' }]))).toBe(
      'Grace left the workspace',
    );
  });

  test('workflow changes list what changed, with the project', () => {
    const qa = { key: 'RF', name: 'Rover Firmware' };
    expect(
      narrateAudit(
        entry(
          'workflow.status_updated',
          [
            { field: 'status', from: 'QA', to: 'QA' },
            { field: 'name', from: 'QA', to: 'Quality' },
            { field: 'category', from: 'started', to: 'completed' },
          ],
          qa,
        ),
      ),
    ).toBe('changed the status “QA” in Rover Firmware: renamed it to “Quality”, made it Done');
    expect(
      narrateAudit(
        entry(
          'workflow.status_deleted',
          [
            { field: 'status', from: 'QA' },
            { field: 'movedTo', to: 'Review' },
          ],
          qa,
        ),
      ),
    ).toBe('deleted the status “QA” in Rover Firmware, moving its tasks to “Review”');
  });

  test('tokens, and kinds it does not know yet', () => {
    expect(
      narrateAudit(
        entry('token.created', [
          { field: 'token', to: 'CI' },
          { field: 'access', to: 'write' },
        ]),
      ),
    ).toBe('created the read and write API token “CI”');
    expect(narrateAudit(entry('integration.connected', []))).toBe('integration connected');
  });
});

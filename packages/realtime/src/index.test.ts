import { describe, expect, test } from 'bun:test';
import { Channel, parseClientMessage } from './index.ts';

const id = '01900000-0000-7000-8000-000000000001';

describe('protocol', () => {
  test('channels are org or a project id, nothing else', () => {
    expect(Channel.safeParse('org').success).toBe(true);
    expect(Channel.safeParse(`project:${id}`).success).toBe(true);
    for (const bad of ['project:nope', 'org:other', `${id}:project:${id}`, 'project:', '']) {
      expect(Channel.safeParse(bad).success).toBe(false);
    }
  });

  test('client messages are validated, garbage is rejected', () => {
    expect(
      parseClientMessage(JSON.stringify({ type: 'subscribe', channel: `project:${id}` })),
    ).toEqual({
      type: 'subscribe',
      channel: `project:${id}`,
    });
    expect(parseClientMessage('{not json')).toBeNull();
    expect(
      parseClientMessage(JSON.stringify({ type: 'subscribe', channel: 'org:someone-else' })),
    ).toBeNull();
    expect(
      parseClientMessage(JSON.stringify({ type: 'presence', channel: 'org', state: {} })),
    ).toBeNull();
  });
});

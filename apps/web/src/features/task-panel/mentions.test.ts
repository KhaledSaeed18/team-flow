/// <reference types="bun" />
import { describe, expect, test } from 'bun:test';
import { findMentions } from './mentions.ts';

const ann = { id: 'a', name: 'Ann' };
const anna = { id: 'b', name: 'Anna' };
const jo = { id: 'j', name: 'Jo' };
const joSmith = { id: 's', name: 'Jo Smith' };
const ids = (text: string, members: { id: string; name: string }[]) =>
  findMentions(text, members).map((m) => m.member.id);

describe('findMentions', () => {
  test('a name counts only as a whole word', () => {
    expect(ids('thanks @Anna!', [ann, anna])).toEqual(['b']);
    expect(ids('@Ann, can you look?', [ann, anna])).toEqual(['a']);
    expect(ids('email@Annex.com', [ann])).toEqual([]);
  });

  test('the longest name wins where names overlap', () => {
    expect(ids('ping @Jo Smith about it', [jo, joSmith])).toEqual(['s']);
    expect(ids('@Jo and @Jo Smith', [jo, joSmith])).toEqual(['j', 's']);
  });

  test('positions are in reading order, for highlighting', () => {
    const found = findMentions('@Anna and @Ann', [ann, anna]);
    expect(found.map((m) => [m.start, m.end])).toEqual([
      [0, 5],
      [10, 14],
    ]);
  });
});

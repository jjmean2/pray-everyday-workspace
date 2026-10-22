import type { Note } from '@pray/api-contract';
import { describe, expect, it } from 'vitest';
import {
  fromNote,
  insertItemAfter,
  isEmptyDraft,
  newDraft,
  removeItem,
  toNoteInput,
  updateItem,
} from './editor-model';

const now = new Date('2026-10-23T07:10:00.000Z');

describe('노트 에디터 모델', () => {
  it('새 노트는 빈 기도제목 행 하나로 시작하고, 비어 있으면 저장하지 않는다', () => {
    const draft = newDraft('note', now, 'item-1');
    expect(draft.items).toHaveLength(1);
    expect(isEmptyDraft(draft)).toBe(true);
  });

  it('Enter로 끼운 행은 두 행 사이의 정렬 키를 받는다', () => {
    let draft = newDraft('note', now, 'a');
    draft = insertItemAfter(draft, 0, 'c').draft;
    const { draft: inserted, index } = insertItemAfter(draft, 0, 'b');
    expect(index).toBe(1);
    const keys = inserted.items.map((item) => item.sortKey);
    expect(inserted.items.map((item) => item.id)).toEqual(['a', 'b', 'c']);
    expect([...keys].sort()).toEqual(keys); // 문자열(바이트) 순서와 화면 순서가 같다
  });

  it('저장할 때 내용 없는 행은 빼고, 빈 문자열은 null로 보낸다', () => {
    let draft = newDraft('note', now, 'a');
    draft = updateItem(draft, 0, { title: '취업' });
    draft = insertItemAfter(draft, 0, 'b').draft; // 빈 행
    draft = insertItemAfter(draft, 1, 'c').draft;
    draft = updateItem(draft, 2, { detail: '검사 결과가 다음 주' });
    const input = toNoteInput(draft);
    expect(input.memo).toBeNull();
    expect(
      input.items.map((item) => [item.id, item.title, item.detail]),
    ).toEqual([
      ['a', '취업', null],
      ['c', null, '검사 결과가 다음 주'],
    ]);
  });

  it('공백만 있는 행은 내용이 없는 것으로 본다', () => {
    let draft = newDraft('note', now, 'a');
    draft = updateItem(draft, 0, { title: '   ' });
    expect(isEmptyDraft(draft)).toBe(true);
    expect(toNoteInput(draft).items).toEqual([]);
  });

  it('행을 지우면 저장할 때 빠진다', () => {
    let draft = newDraft('note', now, 'a');
    draft = updateItem(draft, 0, { title: '취업' });
    draft = insertItemAfter(draft, 0, 'b').draft;
    draft = updateItem(draft, 1, { title: '이사' });
    draft = removeItem(draft, 0);
    expect(toNoteInput(draft).items.map((item) => item.id)).toEqual(['b']);
  });

  it('저장된 노트를 열면 끝에 이어 쓸 빈 행이 붙는다', () => {
    const note: Note = {
      id: 'note',
      prayedAt: now.toISOString(),
      memo: null,
      tagIds: [],
      items: [
        {
          id: 'a',
          sortKey: 'a0',
          title: '취업',
          detail: null,
          tagIds: [],
          threadId: null,
          version: 1,
          updatedAt: now.toISOString(),
        },
      ],
      version: 1,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };
    const draft = fromNote(note, 'empty');
    expect(draft.items.map((item) => item.id)).toEqual(['a', 'empty']);
    expect(draft.items[1]!.sortKey > 'a0').toBe(true);
    expect(toNoteInput(draft).items.map((item) => item.id)).toEqual(['a']);
  });
});

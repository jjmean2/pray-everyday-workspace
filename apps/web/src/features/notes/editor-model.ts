// 노트 에디터의 상태와 편집 동작. 화면과 분리해 테스트한다.
// 기도제목의 경계는 사용자가 행 단위로 정하고(Enter로 새 기도제목), 순서는 분수 인덱스다(ADR-0007).
import type { Note, NoteInput } from '@pray/api-contract';
import { hasPrayerItemContent, isBlank, sortKeyBetween } from '@pray/domain';

export interface DraftItem {
  id: string;
  sortKey: string;
  title: string;
  detail: string;
  tagIds: string[];
  /** 상세 입력란을 펼쳤는가(화면 상태) */
  showDetail: boolean;
}

export interface Draft {
  id: string;
  prayedAt: string;
  memo: string;
  tagIds: string[];
  items: DraftItem[];
}

export function newItem(id: string, sortKey: string): DraftItem {
  return { id, sortKey, title: '', detail: '', tagIds: [], showDetail: false };
}

/** 새 노트. 빈 기도제목 행 하나로 시작한다. */
export function newDraft(id: string, now: Date, firstItemId: string): Draft {
  return {
    id,
    prayedAt: now.toISOString(),
    memo: '',
    tagIds: [],
    items: [newItem(firstItemId, sortKeyBetween(null, null))],
  };
}

export function fromNote(note: Note, emptyItemId: string): Draft {
  const items: DraftItem[] = note.items.map((item) => ({
    id: item.id,
    sortKey: item.sortKey,
    title: item.title ?? '',
    detail: item.detail ?? '',
    tagIds: item.tagIds,
    showDetail: (item.detail ?? '') !== '',
  }));
  const last = items.at(-1);
  return {
    id: note.id,
    prayedAt: note.prayedAt,
    memo: note.memo ?? '',
    tagIds: note.tagIds,
    // 끝에 빈 행을 하나 둬서 바로 이어 쓸 수 있게 한다
    items: [
      ...items,
      newItem(emptyItemId, sortKeyBetween(last?.sortKey ?? null, null)),
    ],
  };
}

/** index 바로 뒤에 빈 기도제목을 끼운다. 끼운 행의 위치를 돌려준다. */
export function insertItemAfter(
  draft: Draft,
  index: number,
  id: string,
): { draft: Draft; index: number } {
  const before = draft.items[index]?.sortKey ?? null;
  const after = draft.items[index + 1]?.sortKey ?? null;
  const item = newItem(id, sortKeyBetween(before, after));
  const items = [...draft.items];
  items.splice(index + 1, 0, item);
  return { draft: { ...draft, items }, index: index + 1 };
}

export function removeItem(draft: Draft, index: number): Draft {
  return { ...draft, items: draft.items.filter((_, i) => i !== index) };
}

export function updateItem(
  draft: Draft,
  index: number,
  patch: Partial<Omit<DraftItem, 'id' | 'sortKey'>>,
): Draft {
  return {
    ...draft,
    items: draft.items.map((item, i) =>
      i === index ? { ...item, ...patch } : item,
    ),
  };
}

function toContent(item: DraftItem) {
  return {
    title: item.title === '' ? null : item.title,
    detail: item.detail === '' ? null : item.detail,
  };
}

/** 저장할 기도제목. 내용이 없는 행(쓰다 만 빈 행)은 보내지 않는다. */
export function savableItems(draft: Draft): DraftItem[] {
  return draft.items.filter((item) => hasPrayerItemContent(toContent(item)));
}

/** 메모도 기도제목도 없다. 아직 서버에 없는 새 노트는 이때 저장하지 않는다(열기만 한 노트가 쌓이지 않게). */
export function isEmptyDraft(draft: Draft): boolean {
  return isBlank(draft.memo) && savableItems(draft).length === 0;
}

export function toNoteInput(draft: Draft): NoteInput {
  return {
    prayedAt: draft.prayedAt,
    memo: draft.memo === '' ? null : draft.memo,
    tagIds: draft.tagIds,
    items: savableItems(draft).map((item) => ({
      id: item.id,
      sortKey: item.sortKey,
      ...toContent(item),
      tagIds: item.tagIds,
    })) as NoteInput['items'],
  };
}

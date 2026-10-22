import { useNavigate } from '@tanstack/react-router';
import { type KeyboardEvent, useEffect, useRef, useState } from 'react';
import { v7 as uuidv7 } from 'uuid';
import { TagPicker } from '../tags/tag-picker';
import {
  type Draft,
  insertItemAfter,
  removeItem,
  updateItem,
} from './editor-model';
import { useDeleteNote } from './queries';
import { type SaveStatus, useAutosave } from './use-autosave';

const STATUS_TEXT: Record<SaveStatus, string> = {
  idle: '',
  pending: '입력 중…',
  saving: '저장 중…',
  saved: '저장됨',
  error: '저장하지 못함',
};

/** datetime-local 입력값(로컬 시각)과 ISO 문자열 사이의 변환 */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function NoteEditor({ initial }: { initial: Draft }) {
  const [draft, setDraft] = useState(initial);
  const { status, error } = useAutosave(draft);
  const deleteNote = useDeleteNote(draft.id);
  const navigate = useNavigate();
  const titleRefs = useRef(new Map<string, HTMLInputElement>());
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (focusId !== null) {
      titleRefs.current.get(focusId)?.focus();
      setFocusId(null);
    }
  }, [focusId]);

  function onTitleKeyDown(
    event: KeyboardEvent<HTMLInputElement>,
    index: number,
  ) {
    const item = draft.items[index]!;
    // 한글 조합 중의 Enter는 조합을 끝내는 키라 새 기도제목을 만들지 않는다
    if (event.key === 'Enter' && !event.nativeEvent.isComposing) {
      event.preventDefault();
      const id = uuidv7();
      setDraft((current) => insertItemAfter(current, index, id).draft);
      setFocusId(id);
    } else if (
      event.key === 'Backspace' &&
      item.title === '' &&
      item.detail === '' &&
      draft.items.length > 1
    ) {
      event.preventDefault();
      // 지운 행의 앞 행으로, 첫 행이었다면 다음 행으로 포커스를 옮긴다
      const target = index > 0 ? draft.items[index - 1]! : draft.items[1]!;
      setDraft((current) => removeItem(current, index));
      setFocusId(target.id);
    } else if (event.key === 'ArrowUp' && index > 0) {
      setFocusId(draft.items[index - 1]!.id);
    } else if (event.key === 'ArrowDown' && index < draft.items.length - 1) {
      setFocusId(draft.items[index + 1]!.id);
    }
  }

  async function onDelete() {
    await deleteNote.mutateAsync();
    await navigate({ to: '/' });
  }

  return (
    <article className="space-y-6">
      <header className="flex items-center justify-between gap-4">
        <input
          type="datetime-local"
          value={toLocalInput(draft.prayedAt)}
          onChange={(event) => {
            if (event.target.value !== '') {
              const prayedAt = new Date(event.target.value).toISOString();
              setDraft((current) => ({ ...current, prayedAt }));
            }
          }}
          aria-label="기도한 시각"
          className="rounded border px-2 py-1 text-sm text-gray-700"
        />
        <span
          className={`text-xs ${status === 'error' ? 'text-red-600' : 'text-gray-400'}`}
          title={error ?? undefined}
        >
          {STATUS_TEXT[status]}
        </span>
      </header>

      <textarea
        value={draft.memo}
        onChange={(event) => {
          const memo = event.target.value;
          setDraft((current) => ({ ...current, memo }));
        }}
        placeholder="메모 (묵상, 그날의 마음… 기도제목이 아닌 글)"
        rows={3}
        className="w-full resize-y rounded border px-3 py-2 text-sm"
        aria-label="메모"
      />

      <ul className="space-y-1">
        {draft.items.map((item, index) => (
          <li
            key={item.id}
            className="group rounded px-1 py-1 hover:bg-gray-50"
          >
            <div className="flex items-start gap-2">
              <span className="mt-2 h-1.5 w-1.5 flex-none rounded-full bg-gray-400" />
              <input
                ref={(element) => {
                  if (element === null) {
                    titleRefs.current.delete(item.id);
                  } else {
                    titleRefs.current.set(item.id, element);
                  }
                }}
                value={item.title}
                onChange={(event) => {
                  const title = event.target.value;
                  setDraft((current) => updateItem(current, index, { title }));
                }}
                onKeyDown={(event) => onTitleKeyDown(event, index)}
                placeholder={
                  index === 0 ? '기도제목 (Enter로 다음 기도제목)' : ''
                }
                className="flex-1 bg-transparent py-0.5 outline-none"
                aria-label={`기도제목 ${index + 1}`}
              />
              <button
                type="button"
                onClick={() =>
                  setDraft((current) =>
                    updateItem(current, index, {
                      showDetail: !item.showDetail,
                    }),
                  )
                }
                className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 focus:opacity-100"
              >
                {item.showDetail ? '접기' : '상세'}
              </button>
            </div>
            {item.showDetail && (
              <div className="ml-4 mt-1 space-y-1">
                <textarea
                  value={item.detail}
                  onChange={(event) => {
                    const detail = event.target.value;
                    setDraft((current) =>
                      updateItem(current, index, { detail }),
                    );
                  }}
                  rows={2}
                  placeholder="상세 (자유롭게. 이 안의 줄바꿈과 목록은 새 기도제목을 만들지 않습니다)"
                  className="w-full resize-y rounded border px-2 py-1 text-sm"
                  aria-label={`기도제목 ${index + 1}의 상세`}
                />
                <TagPicker
                  value={item.tagIds}
                  onChange={(tagIds) =>
                    setDraft((current) =>
                      updateItem(current, index, { tagIds }),
                    )
                  }
                  label={`기도제목 ${index + 1}의 태그`}
                />
              </div>
            )}
          </li>
        ))}
      </ul>

      <footer className="flex items-center justify-between border-t pt-3">
        <TagPicker
          value={draft.tagIds}
          onChange={(tagIds) => setDraft((current) => ({ ...current, tagIds }))}
          label="노트의 태그"
        />
        <button
          type="button"
          onClick={() => void onDelete()}
          disabled={deleteNote.isPending}
          className="text-xs text-gray-400 hover:text-red-600"
        >
          노트 지우기
        </button>
      </footer>
    </article>
  );
}

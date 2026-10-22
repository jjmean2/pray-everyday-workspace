import { useEffect, useRef, useState } from 'react';
import { type Draft, isEmptyDraft, toNoteInput } from './editor-model';
import { useSaveNote } from './queries';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

const DELAY_MS = 800;

/**
 * 쓰는 동안 노트를 통째로 자동 저장한다(PUT, 멱등). 입력이 멈추고 잠시 뒤에 저장하고,
 * 저장 중에 또 바뀌면 끝난 뒤 최신 내용을 다시 저장한다.
 * - 서버에 이미 있는 노트(persisted)는 연 상태를 저장된 것으로 보고, 바뀐 것이 없으면 보내지 않는다
 * - 아직 서버에 없는 새 노트는 비어 있으면 저장하지 않는다(열기만 한 노트가 쌓이지 않게)
 * - cancel() 뒤에는 저장하지 않는다(노트를 지운 뒤 화면을 떠날 때 되살리지 않게)
 */
export function useAutosave(
  draft: Draft,
  options: { persisted: boolean },
): { status: SaveStatus; error: string | null; cancel: () => void } {
  const save = useSaveNote(draft.id);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(draft);
  const persisted = useRef(options.persisted);
  const lastSaved = useRef<string | null>(
    options.persisted ? JSON.stringify(toNoteInput(draft)) : null,
  );
  const inFlight = useRef(false);
  const cancelled = useRef(false);
  latest.current = draft;

  function shouldSkip(current: Draft): boolean {
    return cancelled.current || (!persisted.current && isEmptyDraft(current));
  }

  async function flush() {
    if (inFlight.current || shouldSkip(latest.current)) {
      return;
    }
    const input = toNoteInput(latest.current);
    const serialized = JSON.stringify(input);
    if (serialized === lastSaved.current) {
      return;
    }
    inFlight.current = true;
    setStatus('saving');
    try {
      await save.mutateAsync(input);
      lastSaved.current = serialized;
      persisted.current = true;
      setError(null);
      setStatus('saved');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '저장하지 못했습니다');
      setStatus('error');
    } finally {
      inFlight.current = false;
    }
    // 저장하는 동안 바뀐 내용이 있으면 이어서 저장한다
    if (JSON.stringify(toNoteInput(latest.current)) !== lastSaved.current) {
      void flush();
    }
  }

  useEffect(() => {
    if (shouldSkip(draft)) {
      return;
    }
    if (JSON.stringify(toNoteInput(draft)) === lastSaved.current) {
      return;
    }
    setStatus((current) => (current === 'saving' ? current : 'pending'));
    // flush는 ref로 최신 상태를 읽으므로 draft가 바뀔 때만 타이머를 다시 건다
    const timer = setTimeout(() => void flush(), DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft]);

  // 화면을 떠날 때 남은 변경을 저장한다. 바뀐 것이 없거나 취소했으면 보내지 않는다
  useEffect(() => () => void flush(), []);

  return {
    status,
    error,
    cancel: () => {
      cancelled.current = true;
    },
  };
}

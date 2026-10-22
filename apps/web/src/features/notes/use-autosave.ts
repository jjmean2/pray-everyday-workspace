import { useEffect, useRef, useState } from 'react';
import { type Draft, isEmptyDraft, toNoteInput } from './editor-model';
import { useSaveNote } from './queries';

export type SaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error';

const DELAY_MS = 800;

/**
 * 쓰는 동안 노트를 통째로 자동 저장한다(PUT, 멱등). 입력이 멈추고 잠시 뒤에 저장하고,
 * 저장 중에 또 바뀌면 끝난 뒤 최신 내용을 다시 저장한다. 비어 있는 새 노트는 저장하지 않는다.
 */
export function useAutosave(draft: Draft): {
  status: SaveStatus;
  error: string | null;
} {
  const save = useSaveNote(draft.id);
  const [status, setStatus] = useState<SaveStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(draft);
  const lastSaved = useRef<string | null>(null);
  const inFlight = useRef(false);
  latest.current = draft;

  async function flush() {
    if (inFlight.current || isEmptyDraft(latest.current)) {
      return;
    }
    const input = toNoteInput(latest.current);
    const serialized = JSON.stringify(input);
    if (serialized === lastSaved.current) {
      setStatus('saved');
      return;
    }
    inFlight.current = true;
    setStatus('saving');
    try {
      await save.mutateAsync(input);
      lastSaved.current = serialized;
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
    if (isEmptyDraft(draft)) {
      return;
    }
    setStatus((current) => (current === 'saving' ? current : 'pending'));
    // flush는 ref로 최신 상태를 읽으므로 draft가 바뀔 때만 타이머를 다시 건다
    const timer = setTimeout(() => void flush(), DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft]);

  // 화면을 떠날 때 남은 변경을 저장한다
  useEffect(() => () => void flush(), []);

  return { status, error };
}

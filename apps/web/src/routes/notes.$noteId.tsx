import { useQuery } from '@tanstack/react-query';
import { createFileRoute, Link } from '@tanstack/react-router';
import { v7 as uuidv7 } from 'uuid';
import { RequireLogin } from '../features/auth/require-login';
import { fromNote, newDraft } from '../features/notes/editor-model';
import { NoteEditor } from '../features/notes/note-editor';
import { noteQuery } from '../features/notes/queries';

export const Route = createFileRoute('/notes/$noteId')({
  component: NotePage,
});

function NotePage() {
  const { noteId } = Route.useParams();
  return (
    <RequireLogin>
      <Link to="/" className="mb-4 inline-block text-sm text-gray-500">
        ← 노트 목록
      </Link>
      <LoadedEditor noteId={noteId} />
    </RequireLogin>
  );
}

function LoadedEditor({ noteId }: { noteId: string }) {
  const note = useQuery(noteQuery(noteId));
  if (note.isPending) {
    return <p className="text-sm text-gray-500">불러오는 중…</p>;
  }
  if (note.isError) {
    return <p className="text-sm text-red-600">{note.error.message}</p>;
  }
  // 아직 없는 노트(새로 쓰는 중)면 빈 노트로 시작한다. 에디터는 처음 받은 값만 쓴다
  const initial =
    note.data === null
      ? newDraft(noteId, new Date(), uuidv7())
      : fromNote(note.data, uuidv7());
  return <NoteEditor key={noteId} initial={initial} />;
}

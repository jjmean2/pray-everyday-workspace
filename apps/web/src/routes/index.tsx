import { createFileRoute, useNavigate } from '@tanstack/react-router';
import { v7 as uuidv7 } from 'uuid';
import { RequireLogin } from '../features/auth/require-login';
import { NotesList } from '../features/notes/notes-list';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  const navigate = useNavigate();

  return (
    <RequireLogin>
      <button
        type="button"
        // 노트 ID는 클라이언트가 만든다. 내용을 쓰기 전에는 저장되지 않는다
        onClick={() =>
          void navigate({ to: '/notes/$noteId', params: { noteId: uuidv7() } })
        }
        className="mb-6 w-full rounded bg-gray-900 py-3 text-sm font-medium text-white"
      >
        새 기도 노트
      </button>
      <NotesList />
    </RequireLogin>
  );
}

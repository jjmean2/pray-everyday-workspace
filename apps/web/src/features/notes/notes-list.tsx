import type { Note } from '@pray/api-contract';
import { displayTitle } from '@pray/domain';
import { useInfiniteQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { notesListQuery } from './queries';

const dayFormat = new Intl.DateTimeFormat('ko-KR', {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  weekday: 'short',
});
const timeFormat = new Intl.DateTimeFormat('ko-KR', {
  hour: 'numeric',
  minute: '2-digit',
});

/** 기도한 시각의 날짜(사용자의 시간대)로 노트를 묶는다. "하루"라는 엔티티는 없다. */
function groupByDay(notes: Note[]): [string, Note[]][] {
  const groups = new Map<string, Note[]>();
  for (const note of notes) {
    const day = dayFormat.format(new Date(note.prayedAt));
    groups.set(day, [...(groups.get(day) ?? []), note]);
  }
  return [...groups.entries()];
}

export function NotesList() {
  const notes = useInfiniteQuery(notesListQuery);

  if (notes.isPending) {
    return <p className="text-sm text-gray-500">불러오는 중…</p>;
  }
  if (notes.isError) {
    return <p className="text-sm text-red-600">{notes.error.message}</p>;
  }
  const all = notes.data.pages.flatMap((page) => page.notes);
  if (all.length === 0) {
    return (
      <p className="text-sm text-gray-500">
        아직 노트가 없습니다. 첫 기도 노트를 써 보세요.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {groupByDay(all).map(([day, dayNotes]) => (
        <section key={day}>
          <h2 className="mb-2 text-sm font-medium text-gray-500">{day}</h2>
          <ul className="space-y-2">
            {dayNotes.map((note) => (
              <li key={note.id}>
                <Link
                  to="/notes/$noteId"
                  params={{ noteId: note.id }}
                  className="block rounded border px-4 py-3 hover:bg-gray-50"
                >
                  <p className="text-xs text-gray-400">
                    {timeFormat.format(new Date(note.prayedAt))}
                  </p>
                  {note.memo !== null && (
                    <p className="mt-1 line-clamp-2 text-sm text-gray-600">
                      {note.memo}
                    </p>
                  )}
                  <ul className="mt-1 list-inside list-disc text-sm">
                    {note.items.map((item) => (
                      <li key={item.id}>{displayTitle(item)}</li>
                    ))}
                  </ul>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {notes.hasNextPage && (
        <button
          type="button"
          onClick={() => void notes.fetchNextPage()}
          disabled={notes.isFetchingNextPage}
          className="w-full rounded border py-2 text-sm text-gray-600"
        >
          더 보기
        </button>
      )}
    </div>
  );
}

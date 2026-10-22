import type { Note, NoteInput } from '@pray/api-contract';
import {
  infiniteQueryOptions,
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../lib/api';

function problemMessage(error: { detail?: string; title: string }): string {
  return error.detail ?? error.title;
}

export const notesListQuery = infiniteQueryOptions({
  queryKey: ['notes', 'list'],
  initialPageParam: undefined as string | undefined,
  queryFn: async ({ pageParam }) => {
    const { data, error } = await api.GET('/notes', {
      params: { query: pageParam === undefined ? {} : { cursor: pageParam } },
    });
    if (error !== undefined) {
      throw new Error(problemMessage(error));
    }
    return data;
  },
  getNextPageParam: (page) => page.nextCursor ?? undefined,
});

/** 노트 하나. 아직 없는 노트(새로 쓰는 중)면 null. */
export const noteQuery = (noteId: string) =>
  queryOptions({
    queryKey: ['notes', 'detail', noteId],
    queryFn: async (): Promise<Note | null> => {
      const { data, error, response } = await api.GET('/notes/{noteId}', {
        params: { path: { noteId } },
      });
      if (response.status === 404) {
        return null;
      }
      if (error !== undefined) {
        throw new Error(problemMessage(error));
      }
      return data;
    },
    // 에디터가 연 뒤에는 서버 응답으로 덮어쓰지 않는다(편집 중인 내용이 우선)
    staleTime: Infinity,
  });

export function useSaveNote(noteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: NoteInput) => {
      const { data, error } = await api.PUT('/notes/{noteId}', {
        params: { path: { noteId } },
        body: input,
      });
      if (error !== undefined) {
        throw new Error(problemMessage(error));
      }
      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['notes', 'list'] });
    },
  });
}

export function useDeleteNote(noteId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error, response } = await api.DELETE('/notes/{noteId}', {
        params: { path: { noteId } },
      });
      if (!response.ok) {
        throw new Error(
          error === undefined ? '지우지 못했습니다' : problemMessage(error),
        );
      }
    },
    onSuccess: async () => {
      queryClient.removeQueries({ queryKey: ['notes', 'detail', noteId] });
      await queryClient.invalidateQueries({ queryKey: ['notes', 'list'] });
    },
  });
}

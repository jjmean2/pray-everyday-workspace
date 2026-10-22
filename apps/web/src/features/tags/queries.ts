import type { Tag } from '@pray/api-contract';
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { v7 as uuidv7 } from 'uuid';
import { api } from '../../lib/api';

export const tagsQuery = queryOptions({
  queryKey: ['tags'],
  queryFn: async (): Promise<Tag[]> => {
    const { data, error } = await api.GET('/tags');
    if (error !== undefined) {
      throw new Error(error.detail ?? error.title);
    }
    return data.tags;
  },
});

/** 새 태그를 만든다. ID는 클라이언트가 만든다. */
export function useCreateTag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (name: string) => {
      const { data, error } = await api.PUT('/tags/{tagId}', {
        params: { path: { tagId: uuidv7() } },
        body: { name },
      });
      if (error !== undefined) {
        throw new Error(error.detail ?? error.title);
      }
      return data;
    },
    onSuccess: (tag) => {
      queryClient.setQueryData<Tag[]>(tagsQuery.queryKey, (tags = []) =>
        [...tags, tag].sort((a, b) => a.name.localeCompare(b.name)),
      );
    },
  });
}

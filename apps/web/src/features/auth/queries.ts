import type { CurrentUser } from '@pray/api-contract';
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from '@tanstack/react-query';
import { api } from '../../lib/api';

export const currentUserQuery = queryOptions({
  queryKey: ['auth', 'me'],
  /** 로그인하지 않았으면 null. 그 밖의 실패는 오류로 던진다 */
  queryFn: async (): Promise<CurrentUser | null> => {
    const { data, error, response } = await api.GET('/auth/me');
    if (response.status === 401) {
      return null;
    }
    if (error !== undefined) {
      throw new Error(error.detail ?? error.title);
    }
    return data;
  },
});

export function useDevLogin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (displayName: string) => {
      const { data, error } = await api.POST('/auth/dev/login', {
        body: { displayName },
      });
      if (error !== undefined) {
        throw new Error(error.detail ?? error.title);
      }
      return data;
    },
    onSuccess: (user) => {
      queryClient.setQueryData(currentUserQuery.queryKey, user);
    },
  });
}

export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      // 서버가 세션을 지웠을 때만 로그아웃으로 보여 준다. 기준은 서버에 있다
      const { response } = await api.POST('/auth/logout');
      if (!response.ok) {
        throw new Error('로그아웃하지 못했습니다');
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(currentUserQuery.queryKey, null);
    },
  });
}

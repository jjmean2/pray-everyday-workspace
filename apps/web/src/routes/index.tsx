import { queryOptions, useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { api } from '../lib/api';

const healthQuery = queryOptions({
  queryKey: ['health'],
  queryFn: async () => {
    const { data, error } = await api.GET('/health');
    if (error !== undefined) {
      throw new Error('서버에 연결할 수 없습니다');
    }
    return data;
  },
});

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  const health = useQuery(healthQuery);

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-bold">쌓이는 기도</h1>
      <p className="mt-4 text-sm text-gray-600">
        서버:{' '}
        {health.isPending
          ? '확인 중'
          : health.isError
            ? '연결 안 됨'
            : `${health.data.status}, DB ${health.data.database}`}
      </p>
    </main>
  );
}

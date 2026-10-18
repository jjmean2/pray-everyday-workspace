import { useQuery } from '@tanstack/react-query';
import { createFileRoute } from '@tanstack/react-router';
import { DevLoginForm } from '../features/auth/dev-login-form';
import { currentUserQuery, useLogout } from '../features/auth/queries';

export const Route = createFileRoute('/')({
  component: Home,
});

function Home() {
  const currentUser = useQuery(currentUserQuery);
  const logout = useLogout();

  return (
    <main className="mx-auto max-w-xl p-8">
      <h1 className="text-2xl font-bold">쌓이는 기도</h1>

      {currentUser.isPending && (
        <p className="mt-4 text-sm text-gray-500">확인 중…</p>
      )}

      {currentUser.isError && (
        <p className="mt-4 text-sm text-red-600">
          서버에 연결할 수 없습니다: {currentUser.error.message}
        </p>
      )}

      {currentUser.isSuccess && currentUser.data !== null && (
        <div className="mt-4 flex items-center justify-between">
          <p>
            <span className="font-medium">{currentUser.data.displayName}</span>
            님, 안녕하세요.
          </p>
          <button
            type="button"
            onClick={() => logout.mutate()}
            disabled={logout.isPending}
            className="rounded border px-3 py-1 text-sm"
          >
            로그아웃
          </button>
        </div>
      )}

      {currentUser.isSuccess && currentUser.data === null && (
        <>
          <p className="mt-4 text-sm text-gray-600">로그인이 필요합니다.</p>
          {import.meta.env.DEV && <DevLoginForm />}
        </>
      )}
    </main>
  );
}

import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import type { ReactNode } from 'react';
import { DevLoginForm } from './dev-login-form';
import { currentUserQuery, useLogout } from './queries';

/** 머리글과 로그인 확인. 로그인했을 때만 children을 보여 준다(웹은 로그인 필수). */
export function RequireLogin({ children }: { children: ReactNode }) {
  const currentUser = useQuery(currentUserQuery);
  const logout = useLogout();

  return (
    <main className="mx-auto max-w-xl p-6">
      <header className="mb-6 flex items-center justify-between">
        <Link to="/" className="text-xl font-bold">
          쌓이는 기도
        </Link>
        {currentUser.data != null && (
          <div className="flex items-center gap-3 text-sm">
            <span className="text-gray-600">
              {currentUser.data.displayName}
            </span>
            <button
              type="button"
              onClick={() => logout.mutate()}
              disabled={logout.isPending}
              className="rounded border px-2 py-0.5 text-xs"
            >
              로그아웃
            </button>
          </div>
        )}
      </header>

      {currentUser.isPending && (
        <p className="text-sm text-gray-500">확인 중…</p>
      )}
      {currentUser.isError && (
        <p className="text-sm text-red-600">
          서버에 연결할 수 없습니다: {currentUser.error.message}
        </p>
      )}
      {currentUser.isSuccess && currentUser.data === null && (
        <>
          <p className="text-sm text-gray-600">로그인이 필요합니다.</p>
          {import.meta.env.DEV && <DevLoginForm />}
        </>
      )}
      {currentUser.isSuccess && currentUser.data !== null && children}
    </main>
  );
}

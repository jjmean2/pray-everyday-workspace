import { type FormEvent, useState } from 'react';
import { useDevLogin } from './queries';

/** 개발용 로그인. 개발 빌드에서만 보인다(서버도 DEV_LOGIN=true일 때만 받는다). */
export function DevLoginForm() {
  const [displayName, setDisplayName] = useState('');
  const login = useDevLogin();

  function submit(event: FormEvent) {
    event.preventDefault();
    login.mutate(displayName);
  }

  return (
    <form
      onSubmit={submit}
      className="mt-6 rounded-lg border border-dashed border-amber-400 p-4"
    >
      <p className="text-sm font-medium text-amber-700">개발용 로그인</p>
      <p className="mt-1 text-xs text-gray-500">
        표시 이름으로 로그인합니다. 처음 쓰는 이름이면 사용자가 만들어집니다.
      </p>
      <div className="mt-3 flex gap-2">
        <input
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          placeholder="예: 리더, 회원1"
          className="flex-1 rounded border px-3 py-2 text-sm"
          aria-label="표시 이름"
        />
        <button
          type="submit"
          disabled={login.isPending || displayName === ''}
          className="rounded bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          로그인
        </button>
      </div>
      {login.isError && (
        <p className="mt-2 text-sm text-red-600">{login.error.message}</p>
      )}
    </form>
  );
}

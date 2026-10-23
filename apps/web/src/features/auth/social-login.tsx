import { useLocation, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { API_BASE } from '../../lib/api';

const PROVIDERS = [
  {
    id: 'kakao',
    label: '카카오로 로그인',
    className: 'bg-[#FEE500] text-black/85',
  },
  {
    id: 'google',
    label: '구글로 로그인',
    className: 'border bg-white text-gray-800',
  },
] as const;

// 서버가 로그인에 실패하면 /?loginError=<코드>로 보낸다. 코드 목록의 원본은 명세의 SocialCallback 설명이다
const ERROR_MESSAGES: Record<string, string> = {
  cancelled: '로그인을 취소했습니다.',
  invalid_state:
    '로그인 시간이 지났거나 요청이 맞지 않습니다. 다시 시도해 주세요.',
  provider_error:
    '로그인 서비스와 통신하지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
  not_configured: '이 로그인 방법은 아직 준비되지 않았습니다.',
};

/** 소셜 로그인 버튼. 서버의 로그인 시작 주소로 이동하고, 로그인한 뒤 지금 화면으로 돌아온다. */
export function SocialLogin() {
  const location = useLocation();
  const error = useLoginError();
  // 돌아올 주소에는 오류 안내를 싣지 않는다
  const search = new URLSearchParams(location.searchStr);
  search.delete('loginError');
  const query = search.toString();
  const returnTo = location.pathname + (query === '' ? '' : `?${query}`);

  return (
    <div className="mt-4 flex flex-col gap-2">
      {error !== null && (
        <p className="text-sm text-red-600">
          {ERROR_MESSAGES[error] ?? '로그인하지 못했습니다.'}
        </p>
      )}
      {PROVIDERS.map((provider) => (
        <a
          key={provider.id}
          href={`${API_BASE}/auth/${provider.id}/login?returnTo=${encodeURIComponent(returnTo)}`}
          className={`rounded-lg px-4 py-3 text-center text-sm font-medium ${provider.className}`}
        >
          {provider.label}
        </a>
      ))}
    </div>
  );
}

/** 주소의 loginError를 한 번 읽고 주소에서는 지운다(새로 고침해도 다시 보이지 않게). */
function useLoginError(): string | null {
  const location = useLocation();
  const navigate = useNavigate();
  const [error] = useState(() => {
    const value = (location.search as Record<string, unknown>).loginError;
    return typeof value === 'string' ? value : null;
  });
  useEffect(() => {
    if (error === null) {
      return;
    }
    void navigate({
      to: '.',
      search: (prev: Record<string, unknown>) => ({
        ...prev,
        loginError: undefined,
      }),
      replace: true,
    });
  }, [error, navigate]);
  return error;
}

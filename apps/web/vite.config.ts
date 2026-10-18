import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Vite 기본 포트(5173)는 다른 프로젝트와 자주 겹쳐서 고정 포트를 쓴다. 쓰고 있으면 다른 포트로 옮기지 않고 실패한다
    port: 6102,
    strictPort: true,
    proxy: {
      // 로컬 개발에서 /api 요청은 NestJS 서버(3000)로 보낸다. 운영의 경로 구성은 배포 대상과 함께 정한다.
      '/api': {
        target: 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  plugins: [
    // SPA 모드로 시작하고, 공유 페이지는 나중에 라우트별 SSR을 켠다(ARCHITECTURE의 "기술 스택과 실행 환경").
    tanstackStart({ spa: { enabled: true } }),
    // React 플러그인은 Start 플러그인 뒤에 둔다
    viteReact(),
    tailwindcss(),
  ],
});

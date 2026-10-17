import tailwindcss from '@tailwindcss/vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    proxy: {
      // 로컬 개발에서 /api 요청은 NestJS 서버(3000)로 보낸다. 운영의 경로 구성은 배포 대상과 함께 정한다.
      '/api': {
        target: 'http://localhost:3000',
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
    },
  },
  plugins: [
    // D-09: SPA 모드로 시작한다. 공유 페이지는 나중에 라우트별 SSR을 켠다.
    tanstackStart({ spa: { enabled: true } }),
    // React 플러그인은 Start 플러그인 뒤에 둔다
    viteReact(),
    tailwindcss(),
  ],
});

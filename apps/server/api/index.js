// Vercel 함수. 모든 경로가 여기로 온다(vercel.json의 rewrites). nest build가 만든 앱을 그대로 쓴다.
export { default } from '../dist/serverless.js';

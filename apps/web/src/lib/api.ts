import type { paths } from '@pray/api-contract';
import createClient from 'openapi-fetch';

// API 계약(OpenAPI)에서 생성한 타입으로 서버를 부른다. 클라이언트의 책임은 ARCHITECTURE의 "영역과 모듈의 경계"를 따른다.
export const api = createClient<paths>({ baseUrl: '/api' });

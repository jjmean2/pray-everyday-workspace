import type { paths } from '@pray/api-contract';
import createClient from 'openapi-fetch';

// API 계약(OpenAPI)에서 생성한 타입으로 서버를 부른다. 웹은 비즈니스 로직과 DB 접근을 갖지 않는다(D-09).
export const api = createClient<paths>({ baseUrl: '/api' });

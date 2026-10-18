import { Controller, Get, type INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { configureApp } from '../src/app.setup.js';

/** 명세의 /health와 모양이 다른 응답을 일부러 낸다. */
@Controller('health')
class BrokenHealthController {
  @Get()
  getHealth() {
    return { status: 'fine' };
  }
}

describe('API 계약 검사 (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [BrokenHealthController],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('응답이 명세와 다르면 개발·테스트에서는 500으로 드러난다', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(500);
    // 내부 정보는 담지 않는다
    expect(response.body).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
    });
  });

  it('명세에 없는 경로는 404다', async () => {
    await request(app.getHttpServer()).get('/not-in-spec').expect(404);
  });
});

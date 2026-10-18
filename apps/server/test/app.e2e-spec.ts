import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { loadLocalEnv } from '../src/env.js';

describe('서버 (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    loadLocalEnv();
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health', async () => {
    const response = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    expect(response.body).toEqual({ status: 'ok', database: 'up' });
  });

  it('없는 경로는 Problem Details로 404', async () => {
    const response = await request(app.getHttpServer())
      .get('/no-such-path')
      .expect(404);
    expect(response.headers['content-type']).toMatch(
      /^application\/problem\+json/,
    );
    expect(response.body).toMatchObject({ status: 404, title: 'Not Found' });
  });
});

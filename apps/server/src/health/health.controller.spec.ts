import { Test } from '@nestjs/testing';
import { DATABASE } from '../database/database.module.js';
import { HealthController } from './health.controller.js';

async function createController(
  execute: () => Promise<unknown>,
): Promise<HealthController> {
  const moduleRef = await Test.createTestingModule({
    controllers: [HealthController],
    providers: [{ provide: DATABASE, useValue: { execute } }],
  }).compile();
  return moduleRef.get(HealthController);
}

describe('HealthController', () => {
  it('DB에 연결되면 database: up', async () => {
    const controller = await createController(async () => ({ rows: [] }));
    await expect(controller.getHealth()).resolves.toEqual({
      status: 'ok',
      database: 'up',
    });
  });

  it('DB에 연결되지 않으면 database: down', async () => {
    const controller = await createController(async () => {
      throw new Error('connection refused');
    });
    await expect(controller.getHealth()).resolves.toEqual({
      status: 'ok',
      database: 'down',
    });
  });
});

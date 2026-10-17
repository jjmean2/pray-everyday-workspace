import { Controller, Get, Inject } from '@nestjs/common';
import type { Health } from '@pray/api-contract';
import { sql } from 'drizzle-orm';
import { DATABASE, type Database } from '../database/database.module.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(DATABASE) private readonly db: Database) {}

  @Get()
  async getHealth(): Promise<Health> {
    try {
      await this.db.execute(sql`select 1`);
      return { status: 'ok', database: 'up' };
    } catch {
      return { status: 'ok', database: 'down' };
    }
  }
}

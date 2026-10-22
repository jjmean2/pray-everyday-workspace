import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module.js';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health/health.controller.js';
import { NotesModule } from './notes/notes.module.js';
import { TagsModule } from './tags/tags.module.js';

@Module({
  imports: [DatabaseModule, AuthModule.register(), NotesModule, TagsModule],
  controllers: [HealthController],
})
export class AppModule {}

import { Module } from '@nestjs/common';
import { SessionModule } from '../auth/session.module.js';
import { TagsController } from './tags.controller.js';
import { TagsService } from './tags.service.js';

/** 개인 기록의 태그. 개인 영역이라 작성자만 읽고 쓴다. */
@Module({
  imports: [SessionModule],
  controllers: [TagsController],
  providers: [TagsService],
})
export class TagsModule {}

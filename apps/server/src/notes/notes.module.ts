import { Module } from '@nestjs/common';
import { SessionModule } from '../auth/session.module.js';
import { NotesController } from './notes.controller.js';
import { NotesService } from './notes.service.js';

/** 개인 기록의 노트와 기도제목. 개인 영역이라 작성자만 읽고 쓴다. */
@Module({
  imports: [SessionModule],
  controllers: [NotesController],
  providers: [NotesService],
})
export class NotesModule {}

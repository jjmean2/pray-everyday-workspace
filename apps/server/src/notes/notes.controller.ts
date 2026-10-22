import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { Note, NoteInput, NoteList } from '@pray/api-contract';
import { CurrentSession, SessionGuard } from '../auth/session.guard.js';
import type { ValidatedSession } from '../auth/session.service.js';
import { NotesService } from './notes.service.js';

/** 요청은 명세 검사기가 먼저 검사한다(ADR-0006). */
@Controller('notes')
@UseGuards(SessionGuard)
export class NotesController {
  constructor(private readonly notes: NotesService) {}

  @Get()
  list(
    @CurrentSession() session: ValidatedSession,
    @Query('cursor') cursor: string | undefined,
    @Query('limit') limit: string | undefined,
  ): Promise<NoteList> {
    return this.notes.list(
      session.user.id,
      cursor,
      limit === undefined ? undefined : Number(limit),
    );
  }

  @Get(':noteId')
  get(
    @CurrentSession() session: ValidatedSession,
    @Param('noteId') noteId: string,
  ): Promise<Note> {
    return this.notes.get(session.user.id, noteId);
  }

  @Put(':noteId')
  save(
    @CurrentSession() session: ValidatedSession,
    @Param('noteId') noteId: string,
    @Body() input: NoteInput,
  ): Promise<Note> {
    return this.notes.save(session.user.id, noteId, input);
  }

  @Delete(':noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentSession() session: ValidatedSession,
    @Param('noteId') noteId: string,
  ): Promise<void> {
    await this.notes.delete(session.user.id, noteId);
  }
}

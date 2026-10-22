import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Put,
  UseGuards,
} from '@nestjs/common';
import type { Tag, TagInput, TagList } from '@pray/api-contract';
import { CurrentSession, SessionGuard } from '../auth/session.guard.js';
import type { ValidatedSession } from '../auth/session.service.js';
import { TagsService } from './tags.service.js';

@Controller('tags')
@UseGuards(SessionGuard)
export class TagsController {
  constructor(private readonly tags: TagsService) {}

  @Get()
  list(@CurrentSession() session: ValidatedSession): Promise<TagList> {
    return this.tags.list(session.user.id);
  }

  @Put(':tagId')
  save(
    @CurrentSession() session: ValidatedSession,
    @Param('tagId') tagId: string,
    @Body() input: TagInput,
  ): Promise<Tag> {
    return this.tags.save(session.user.id, tagId, input);
  }

  @Delete(':tagId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(
    @CurrentSession() session: ValidatedSession,
    @Param('tagId') tagId: string,
  ): Promise<void> {
    await this.tags.delete(session.user.id, tagId);
  }
}

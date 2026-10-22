import { BadRequestException } from '@nestjs/common';

/** 노트 목록의 커서. 마지막 노트의 (기도한 시각, ID)를 감싼 불투명한 문자열이다. */
export interface NoteCursor {
  prayedAt: Date;
  id: string;
}

export function encodeNoteCursor(cursor: NoteCursor): string {
  return Buffer.from(
    JSON.stringify([cursor.prayedAt.toISOString(), cursor.id]),
  ).toString('base64url');
}

export function decodeNoteCursor(value: string): NoteCursor {
  try {
    const parsed: unknown = JSON.parse(
      Buffer.from(value, 'base64url').toString('utf8'),
    );
    if (
      Array.isArray(parsed) &&
      parsed.length === 2 &&
      typeof parsed[0] === 'string' &&
      typeof parsed[1] === 'string'
    ) {
      const prayedAt = new Date(parsed[0]);
      if (!Number.isNaN(prayedAt.getTime())) {
        return { prayedAt, id: parsed[1] };
      }
    }
  } catch {
    // 아래에서 400으로 돌려준다
  }
  throw new BadRequestException('cursor가 올바르지 않습니다');
}

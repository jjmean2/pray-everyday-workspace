import {
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { toProblem } from './problem-details.filter.js';

describe('toProblem', () => {
  it('메시지가 있는 HTTP 오류는 detail에 메시지를 담는다', () => {
    expect(toProblem(new UnauthorizedException('로그인이 필요합니다'))).toEqual(
      {
        type: 'about:blank',
        title: 'Unauthorized',
        status: 401,
        detail: '로그인이 필요합니다',
      },
    );
  });

  it('기본 메시지만 있으면 detail을 생략한다', () => {
    expect(toProblem(new NotFoundException())).toEqual({
      type: 'about:blank',
      title: 'Not Found',
      status: 404,
    });
  });

  it('HTTP 오류가 아니면 내부 정보를 드러내지 않고 500을 돌려준다', () => {
    expect(toProblem(new Error('DB 비밀번호가 틀렸다'))).toEqual({
      type: 'about:blank',
      title: 'Internal Server Error',
      status: 500,
    });
  });

  it('자기 4xx 상태를 가진 오류는 그 상태를 쓰고 메시지는 담지 않는다', () => {
    const tooLarge = Object.assign(new Error('request entity too large'), {
      status: 413,
      statusCode: 413,
    });
    expect(toProblem(tooLarge)).toEqual({
      type: 'about:blank',
      title: 'Payload Too Large',
      status: 413,
    });
  });

  it('명세 검사 오류는 어느 부분이 왜 틀렸는지 detail에 담는다', () => {
    const invalid = Object.assign(new Error('request/body must ...'), {
      status: 400,
      errors: [
        {
          path: '/body/displayName',
          message: 'must NOT have fewer than 1 characters',
        },
        { path: '/body/role', message: 'must NOT have additional properties' },
      ],
    });
    expect(toProblem(invalid)).toEqual({
      type: 'about:blank',
      title: 'Bad Request',
      status: 400,
      detail:
        '/body/displayName must NOT have fewer than 1 characters; /body/role must NOT have additional properties',
    });
  });

  it('5xx 상태를 가진 일반 오류는 500으로 둔다', () => {
    const upstream = Object.assign(new Error('upstream'), { status: 502 });
    expect(toProblem(upstream).status).toBe(500);
  });

  it('400 오류의 메시지를 담는다', () => {
    expect(toProblem(new BadRequestException('잘못된 요청')).detail).toBe(
      '잘못된 요청',
    );
  });
});

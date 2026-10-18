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

  it('400 오류의 메시지를 담는다', () => {
    expect(toProblem(new BadRequestException('잘못된 요청')).detail).toBe(
      '잘못된 요청',
    );
  });
});

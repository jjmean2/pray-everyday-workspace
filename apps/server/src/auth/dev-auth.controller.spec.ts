import { BadRequestException } from '@nestjs/common';
import { parseDevLoginRequest } from './dev-auth.controller.js';

describe('parseDevLoginRequest', () => {
  it('앞뒤 공백을 지운 표시 이름을 받는다', () => {
    expect(parseDevLoginRequest({ displayName: '  리더 ' })).toEqual({
      displayName: '리더',
    });
  });

  it.each([
    ['객체가 아님', 'hello'],
    ['null', null],
    ['배열', []],
    ['필드 없음', {}],
    ['문자열이 아님', { displayName: 3 }],
    ['빈 이름', { displayName: '   ' }],
    ['50자 초과', { displayName: '가'.repeat(51) }],
    ['다른 필드', { displayName: '리더', role: 'admin' }],
  ])('%s이면 400', (_label, body) => {
    expect(() => parseDevLoginRequest(body)).toThrow(BadRequestException);
  });
});

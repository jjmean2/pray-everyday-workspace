import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Problem } from '@pray/api-contract';
import type { Response } from 'express';
import { STATUS_CODES } from 'node:http';

/** 모든 오류를 RFC 9457 Problem Details로 돌려준다(CONVENTIONS). */
@Catch()
export class ProblemDetailsFilter implements ExceptionFilter {
  private readonly logger = new Logger(ProblemDetailsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const problem = toProblem(exception);
    if (problem.status >= 500) {
      this.logger.error(exception);
    }
    response
      .status(problem.status)
      .type('application/problem+json')
      .json(problem);
  }
}

export function toProblem(exception: unknown): Problem {
  if (!(exception instanceof HttpException)) {
    // body-parser의 PayloadTooLargeError(413)처럼 자기 4xx 상태를 가진 오류는 그 상태를 쓴다.
    // 메시지는 내부 정보일 수 있어 담지 않는다
    const clientStatus = clientErrorStatus(exception);
    return problem(clientStatus ?? HttpStatus.INTERNAL_SERVER_ERROR);
  }
  const status = exception.getStatus();
  const body = exception.getResponse();
  const message =
    typeof body === 'string'
      ? body
      : typeof (body as { message?: unknown }).message === 'string'
        ? (body as { message: string }).message
        : undefined;
  return problem(status, message);
}

function clientErrorStatus(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }
  const { status, statusCode } = error as {
    status?: unknown;
    statusCode?: unknown;
  };
  const value = typeof status === 'number' ? status : statusCode;
  return typeof value === 'number' && value >= 400 && value < 500
    ? value
    : undefined;
}

function problem(status: number, detail?: string): Problem {
  const title = STATUS_CODES[status] ?? 'Error';
  const result: Problem = { type: 'about:blank', title, status };
  // Nest의 기본 메시지는 제목과 같으므로 그때는 detail을 생략한다
  if (detail !== undefined && detail !== title) {
    result.detail = detail;
  }
  return result;
}

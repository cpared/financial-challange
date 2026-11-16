import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { Request, Response } from 'express';
import { jest } from '@jest/globals';
import { ContextLogger } from './context-logger.js';
import { GlobalExceptionFilter } from './global-exception.filter.js';
import { RequestContextService } from './request-context.service.js';
import { RequestContextStorage } from './request-context.storage.js';

describe('GlobalExceptionFilter', () => {
  const request = {
    method: 'GET',
    baseUrl: '',
    route: { path: '/users/:userId/portfolio' },
  };
  const response = {};
  const adapter = {
    isHeadersSent: jest.fn(() => false),
    reply: jest.fn(),
  };
  let filter: GlobalExceptionFilter;
  let logger: ContextLogger;

  beforeEach(() => {
    jest.clearAllMocks();
    logger = new ContextLogger(
      new RequestContextService(new RequestContextStorage()),
    );
    filter = new GlobalExceptionFilter(
      { httpAdapter: adapter } as unknown as HttpAdapterHost,
      logger,
    );
  });

  function host() {
    return {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => request as Request,
        getResponse: () => response as Response,
      }),
    } as never;
  }

  it('preserves established HTTP exception response bodies and status codes', () => {
    const logEvent = jest.spyOn(logger, 'event');

    filter.catch(
      new HttpException(
        { statusCode: HttpStatus.BAD_REQUEST, message: 'Invalid input' },
        HttpStatus.BAD_REQUEST,
      ),
      host(),
    );

    expect(adapter.reply).toHaveBeenCalledWith(
      response,
      { statusCode: 400, message: 'Invalid input' },
      400,
    );
    expect(logEvent).toHaveBeenCalledWith(
      'warn',
      'HTTP request failed',
      expect.objectContaining({
        method: 'GET',
        route: '/users/:userId/portfolio',
        statusCode: 400,
      }),
    );
  });

  it('hides unknown exception details from the HTTP response', () => {
    filter.catch(new Error('database connection credential'), host());

    expect(adapter.reply).toHaveBeenCalledWith(
      response,
      { statusCode: 500, message: 'Internal server error' },
      500,
    );
  });
});

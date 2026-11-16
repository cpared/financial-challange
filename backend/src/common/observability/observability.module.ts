import {
  Global,
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ContextLogger } from './context-logger.js';
import { GlobalExceptionFilter } from './global-exception.filter.js';
import { RequestContextMiddleware } from './request-context.middleware.js';
import { RequestContextService } from './request-context.service.js';
import { RequestContextStorage } from './request-context.storage.js';
import { RequestLoggingInterceptor } from './request-logging.interceptor.js';
import { TelemetryService } from './telemetry.service.js';
import { shutdownTelemetry } from './telemetry.bootstrap.js';

class ObservabilityShutdown {
  async onApplicationShutdown(): Promise<void> {
    await shutdownTelemetry();
  }
}

@Global()
@Module({
  providers: [
    RequestContextStorage,
    RequestContextService,
    RequestContextMiddleware,
    TelemetryService,
    ContextLogger,
    { provide: APP_INTERCEPTOR, useClass: RequestLoggingInterceptor },
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    ObservabilityShutdown,
  ],
  exports: [RequestContextService, TelemetryService, ContextLogger],
})
export class ObservabilityModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(RequestContextMiddleware)
      .forRoutes({ path: '{*path}', method: RequestMethod.ALL });
  }
}

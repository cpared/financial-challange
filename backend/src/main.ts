import { initializeTelemetry } from './common/observability/telemetry.bootstrap.js';

async function bootstrap(): Promise<void> {
  initializeTelemetry();
  const [
    { NestFactory },
    { ValidationPipe },
    { ConfigService },
    { AppModule },
    { ContextLogger },
  ] = await Promise.all([
    import('@nestjs/core'),
    import('@nestjs/common'),
    import('@nestjs/config'),
    import('./app.module.js'),
    import('./common/observability/context-logger.js'),
  ]);
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(ContextLogger));
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: 'http://localhost:5173',
    methods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'X-Request-ID', 'traceparent'],
    exposedHeaders: ['X-Request-ID', 'traceparent'],
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  const config = app.get(ConfigService);
  app.enableShutdownHooks();
  await app.listen(config.getOrThrow<number>('PORT'));
}

await bootstrap();

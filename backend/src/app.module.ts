import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module.js';
import { InstrumentsModule } from './modules/instruments/instruments.module.js';
import { OrdersModule } from './modules/orders/orders.module.js';
import { PortfolioModule } from './modules/portfolio/portfolio.module.js';

function validateEnvironment(
  config: Record<string, unknown>,
): Record<string, unknown> {
  const databaseUrl = config.DATABASE_URL;
  if (typeof databaseUrl !== 'string' || databaseUrl.trim().length === 0) {
    throw new Error('DATABASE_URL is required.');
  }

  let databaseProtocol: string;
  try {
    databaseProtocol = new URL(databaseUrl).protocol;
  } catch {
    throw new Error('DATABASE_URL must be a valid PostgreSQL URL.');
  }
  if (databaseProtocol !== 'postgres:' && databaseProtocol !== 'postgresql:') {
    throw new Error('DATABASE_URL must use the PostgreSQL protocol.');
  }

  const port = Number(config.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }

  return { ...config, PORT: port };
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnvironment }),
    DatabaseModule,
    InstrumentsModule,
    OrdersModule,
    PortfolioModule,
  ],
})
export class AppModule {}

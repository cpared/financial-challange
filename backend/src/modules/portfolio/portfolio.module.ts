import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { PortfolioController } from './controllers/portfolio.controller.js';
import { PortfolioRepository } from './repositories/portfolio.repository.js';
import { PortfolioService } from './services/portfolio.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [PortfolioController],
  providers: [PortfolioRepository, PortfolioService],
})
export class PortfolioModule {}

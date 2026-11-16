import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { InstrumentsController } from './controllers/instruments.controller.js';
import { InstrumentsRepository } from './repositories/instruments.repository.js';
import { InstrumentsService } from './services/instruments.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [InstrumentsController],
  providers: [InstrumentsRepository, InstrumentsService],
})
export class InstrumentsModule {}

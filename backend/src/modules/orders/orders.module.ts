import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { OrdersController } from './controllers/orders.controller.js';
import { OrdersRepository } from './repositories/orders.repository.js';
import { OrdersService } from './services/orders.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [OrdersController],
  providers: [OrdersRepository, OrdersService],
})
export class OrdersModule {}

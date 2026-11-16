import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module.js';
import { OrdersController } from './controllers/orders.controller.js';
import { OrdersRepository } from './repositories/orders.repository.js';
import { OrdersService } from './services/orders.service.js';
import { CashCalculator } from '../../common/domain/cash/cash-calculator.js';
import { PositionQuantityCalculator } from '../../common/domain/positions/position-quantity-calculator.js';

@Module({
  imports: [DatabaseModule],
  controllers: [OrdersController],
  providers: [
    OrdersRepository,
    OrdersService,
    CashCalculator,
    PositionQuantityCalculator,
  ],
})
export class OrdersModule {}

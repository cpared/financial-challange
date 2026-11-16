import { Injectable } from '@nestjs/common';
import { calculateCashBalance } from '../../../common/utils/cash-balance.js';
import type {
  CashBalance,
  CashOrderMovement,
} from '../../../common/utils/cash-balance.js';
import { PortfolioOrderRepositoryDto } from '../repositories/dto/portfolio-repository-response.dto.js';

@Injectable()
export class CashCalculator {
  calculate(orders: readonly PortfolioOrderRepositoryDto[]): CashBalance {
    const movements: readonly CashOrderMovement[] = orders;
    return calculateCashBalance(movements);
  }
}

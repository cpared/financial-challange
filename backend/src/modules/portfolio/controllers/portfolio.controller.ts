import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { PortfolioResponseDto } from './dto/portfolio-response.dto.js';
import { PortfolioService } from '../services/portfolio.service.js';

@Controller('users/:userId')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get('portfolio')
  async getPortfolio(
    @Param('userId', ParseIntPipe) userId: number,
  ): Promise<PortfolioResponseDto> {
    const portfolio = await this.portfolioService.getPortfolio(userId);
    return PortfolioResponseDto.map(portfolio);
  }
}

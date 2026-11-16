import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateOrderRequestDto } from './dto/create-order-request.dto.js';
import { OrderResponseDto } from './dto/order-response.dto.js';
import { OrdersService } from '../services/orders.service.js';
import { CreateOrderServiceInputDto } from '../services/dto/create-order-service-input.dto.js';

@Controller('users/:userId')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('orders')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() request: CreateOrderRequestDto,
  ): Promise<OrderResponseDto> {
    const input = new CreateOrderServiceInputDto(
      userId,
      request.instrumentId,
      request.side,
      request.type,
      request.quantity,
      request.amountArs,
      request.price,
    );
    const order = await this.ordersService.create(input);
    return OrderResponseDto.map(order);
  }

  @Patch('orders/:orderId/cancel')
  async cancel(
    @Param('userId', ParseIntPipe) userId: number,
    @Param('orderId', ParseIntPipe) orderId: number,
  ): Promise<OrderResponseDto> {
    const order = await this.ordersService.cancel(userId, orderId);
    return OrderResponseDto.map(order);
  }
}

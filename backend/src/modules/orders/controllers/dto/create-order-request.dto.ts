import {
  IsEnum,
  IsInt,
  IsNumber,
  Max,
  Min,
  Validate,
  ValidateIf,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { OrderSide, OrderType } from '../../../../common/enums/order.enums.js';

@ValidatorConstraint({ name: 'validOrderFields', async: false })
class ValidOrderFieldsConstraint implements ValidatorConstraintInterface {
  validate(_value: unknown, args?: ValidationArguments): boolean {
    if (!args) {
      return false;
    }
    const request = args.object as CreateOrderRequestDto;
    const hasQuantity = request.quantity !== undefined;
    const hasAmount = request.amountArs !== undefined;
    const hasRequiredSize = hasQuantity !== hasAmount;
    const hasRequiredLimitPrice =
      request.type !== OrderType.Limit || request.price !== undefined;

    return hasRequiredSize && hasRequiredLimitPrice;
  }

  defaultMessage(): string {
    return 'Provide exactly one of quantity or amountArs; LIMIT orders also require price.';
  }
}

export class CreateOrderRequestDto {
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  @Validate(ValidOrderFieldsConstraint)
  instrumentId!: number;

  @IsEnum(OrderSide)
  side!: OrderSide;

  @IsEnum(OrderType)
  type!: OrderType;

  @ValidateIf((_request, value: unknown) => value !== undefined)
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  quantity?: number;

  @ValidateIf((_request, value: unknown) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99_999_999.99)
  amountArs?: number;

  @ValidateIf((_request, value: unknown) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(99_999_999.99)
  price?: number;
}

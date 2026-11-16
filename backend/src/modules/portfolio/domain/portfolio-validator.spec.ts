import { OrderSide, OrderStatus } from '../../../common/enums/order.enums.js';
import {
  PortfolioInstrumentRepositoryDto,
  PortfolioOrderRepositoryDto,
} from '../repositories/dto/portfolio-repository-response.dto.js';
import { PortfolioDataIntegrityError } from './portfolio-errors.js';
import { PortfolioValidator } from './portfolio-validator.js';

const instrument = new PortfolioInstrumentRepositoryDto(
  47,
  'TEST',
  'Test asset',
  'ACCIONES',
  '110.00',
  '100.00',
);

function order(
  overrides: Partial<PortfolioOrderRepositoryDto> = {},
): PortfolioOrderRepositoryDto {
  return new PortfolioOrderRepositoryDto(
    overrides.id ?? 1,
    overrides.instrumentId === undefined ? 47 : overrides.instrumentId,
    overrides.size === undefined ? 2 : overrides.size,
    overrides.price === undefined ? '100.00' : overrides.price,
    overrides.side === undefined ? OrderSide.Buy : overrides.side,
    overrides.status === undefined ? OrderStatus.Filled : overrides.status,
    overrides.datetime === undefined
      ? new Date('2026-01-01T10:00:00.000Z')
      : overrides.datetime,
    overrides.instrument === undefined ? instrument : overrides.instrument,
  );
}

describe('PortfolioValidator', () => {
  const validator = new PortfolioValidator();

  it('converts valid FILLED trades into ordered domain movements', () => {
    const result = validator.validateOrders([order()]);

    expect(result.trades).toMatchObject([
      {
        instrumentId: 47,
        side: OrderSide.Buy,
        quantity: 2n,
        priceInCents: 10_000n,
      },
    ]);
    expect(result.instruments.get(47)).toBe(instrument);
  });

  it.each([null, 0, -1])('rejects invalid filled quantity %s', (size) => {
    expect(() => validator.validateOrders([order({ size })])).toThrow(
      PortfolioDataIntegrityError,
    );
  });

  it('rejects a filled trade without an associated instrument', () => {
    expect(() =>
      validator.validateOrders([order({ instrument: null })]),
    ).toThrow(PortfolioDataIntegrityError);
  });
});

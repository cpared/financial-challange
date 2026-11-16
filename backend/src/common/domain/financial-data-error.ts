export class InvalidFinancialDataError extends Error {
  constructor() {
    super('Financial data is inconsistent and cannot be calculated.');
    this.name = 'InvalidFinancialDataError';
  }
}

export class MissingTradePriceError extends InvalidFinancialDataError {
  constructor() {
    super();
    this.name = 'MissingTradePriceError';
  }
}

export function parseOrderSize(size: number | null): bigint {
  if (
    size === null ||
    !Number.isInteger(size) ||
    size <= 0 ||
    size > 2_147_483_647
  ) {
    throw new InvalidFinancialDataError();
  }
  return BigInt(size);
}

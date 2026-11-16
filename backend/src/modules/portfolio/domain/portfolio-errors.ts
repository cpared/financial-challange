export class PortfolioDataIntegrityError extends Error {
  constructor() {
    super('Portfolio data is inconsistent and cannot be calculated.');
    this.name = 'PortfolioDataIntegrityError';
  }
}

export class PortfolioMarketDataUnavailableError extends Error {
  constructor() {
    super('Market data is currently unavailable for one or more positions.');
    this.name = 'PortfolioMarketDataUnavailableError';
  }
}

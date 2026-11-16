export interface CalculatedPortfolioPosition {
  readonly instrumentId: number;
  readonly ticker: string | null;
  readonly name: string | null;
  readonly quantity: number;
  readonly marketValueArs: string;
  readonly totalReturnArs: string;
  readonly totalReturnPercent: string | null;
  readonly dailyReturnPercent: string;
}

export interface PortfolioCalculationResult {
  readonly userId: number;
  readonly totalAccountValueArs: string;
  readonly availableCashArs: string;
  readonly positions: readonly CalculatedPortfolioPosition[];
}

export interface CashMovement {
  readonly size: number | null;
  readonly price: number | string | null;
  readonly side: string | null;
  readonly status: string | null;
}

export interface CashBalance {
  readonly cashBalanceInCents: bigint;
  readonly reservedCashInCents: bigint;
  readonly availableCashInCents: bigint;
}

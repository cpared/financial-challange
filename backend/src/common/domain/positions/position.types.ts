export interface PositionMovement {
  readonly instrumentId: number | null;
  readonly size: number | null;
  readonly side: string | null;
  readonly status: string | null;
}

export interface PositionQuantity {
  readonly effectiveQuantity: bigint;
  readonly reservedQuantity: bigint;
  readonly availableQuantity: bigint;
}

export const queryKeys = {
  portfolio: (userId: number) => ['portfolio', userId] as const,
  instruments: (query: string) => ['instruments', query] as const,
  orderActivity: (userId: number) => ['order-activity', userId] as const,
}

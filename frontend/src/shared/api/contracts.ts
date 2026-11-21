import { z } from 'zod'

export const instrumentSchema = z.object({
  id: z.number().int(),
  ticker: z.string().nullable(),
  name: z.string().nullable(),
  type: z.string().nullable(),
})

export const portfolioPositionSchema = z.object({
  instrumentId: z.number().int(),
  ticker: z.string().nullable(),
  name: z.string().nullable(),
  quantity: z.number(),
  marketValueArs: z.number(),
  totalReturnArs: z.number(),
  totalReturnPercent: z.number().nullable(),
  dailyReturnPercent: z.number().nullable(),
})

export const portfolioSchema = z.object({
  userId: z.number().int(),
  totalAccountValueArs: z.number(),
  availableCashArs: z.number(),
  positions: z.array(portfolioPositionSchema),
})

export const orderSchema = z.object({
  id: z.number().int(),
  instrumentId: z.number().int().nullable(),
  userId: z.number().int().nullable(),
  size: z.number().nullable(),
  price: z.number().nullable(),
  type: z.string().nullable(),
  side: z.string().nullable(),
  status: z.string().nullable(),
  datetime: z.string().nullable(),
})

export const createOrderRequestSchema = z.object({
  instrumentId: z.number().int().min(1).max(2_147_483_647),
  side: z.enum(['BUY', 'SELL']),
  type: z.enum(['MARKET', 'LIMIT']),
  quantity: z.number().int().min(1).max(2_147_483_647).optional(),
  amountArs: z.number().min(0.01).max(99_999_999.99).optional(),
  price: z.number().min(0.01).max(99_999_999.99).optional(),
}).superRefine((request, context) => {
  if ((request.quantity === undefined) === (request.amountArs === undefined)) {
    context.addIssue({
      code: 'custom',
      message: 'Indica cantidad o monto en ARS, pero no ambos.',
    })
  }
  if (request.type === 'LIMIT' && request.price === undefined) {
    context.addIssue({
      code: 'custom',
      message: 'Las órdenes LIMIT requieren un precio.',
      path: ['price'],
    })
  }
})

export type Instrument = z.infer<typeof instrumentSchema>
export type Portfolio = z.infer<typeof portfolioSchema>
export type PortfolioPosition = z.infer<typeof portfolioPositionSchema>
export type Order = z.infer<typeof orderSchema>
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>

import { describe, expect, it } from 'vitest'
import { orderFormSchema } from './orderFormSchema'

describe('order form validation', () => {
  const validForm = {
    side: 'BUY' as const,
    type: 'MARKET' as const,
    sizeMode: 'quantity' as const,
    quantity: 2,
    amountArs: undefined,
    price: undefined,
  }

  it('accepts a market order by quantity', () => {
    expect(orderFormSchema.safeParse(validForm).success).toBe(true)
  })

  it('requires a limit price and the selected size input', () => {
    expect(
      orderFormSchema.safeParse({
        ...validForm,
        type: 'LIMIT',
        quantity: undefined,
      }).success,
    ).toBe(false)
    expect(
      orderFormSchema.safeParse({
        ...validForm,
        type: 'LIMIT',
        price: 10,
        quantity: undefined,
        sizeMode: 'amountArs',
        amountArs: 100,
      }).success,
    ).toBe(true)
  })
})

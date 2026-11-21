import { z } from 'zod'

export const orderFormSchema = z
  .object({
    side: z.enum(['BUY', 'SELL']),
    type: z.enum(['MARKET', 'LIMIT']),
    sizeMode: z.enum(['quantity', 'amountArs']),
    quantity: z.number().optional(),
    amountArs: z.number().optional(),
    price: z.number().optional(),
  })
  .superRefine((values, context) => {
    if (values.sizeMode === 'quantity') {
      if (
        values.quantity === undefined ||
        !Number.isInteger(values.quantity) ||
        values.quantity < 1 ||
        values.quantity > 2_147_483_647
      ) {
        context.addIssue({
          code: 'custom',
          message: 'La cantidad debe ser un entero positivo.',
          path: ['quantity'],
        })
      }
    } else if (
      values.amountArs === undefined ||
      values.amountArs < 0.01 ||
      values.amountArs > 99_999_999.99
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Indica un monto entre 0,01 y 99.999.999,99 ARS.',
        path: ['amountArs'],
      })
    }

    if (
      values.type === 'LIMIT' &&
      (values.price === undefined ||
        values.price < 0.01 ||
        values.price > 99_999_999.99)
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Las órdenes LIMIT requieren un precio positivo.',
        path: ['price'],
      })
    }
  })

export type OrderFormValues = z.infer<typeof orderFormSchema>

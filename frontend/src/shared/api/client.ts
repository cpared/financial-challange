import { z } from 'zod'
import {
  createOrderRequestSchema,
  instrumentSchema,
  orderSchema,
  portfolioSchema,
} from './contracts'
import type { CreateOrderRequest } from './contracts'

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000')
  .replace(/\/+$/, '')
const apiPrefix = '/api/v1'
const requestTimeoutMs = 10_000

export class ApiError extends Error {
  readonly status: number | null
  readonly details: readonly string[]

  constructor(
    message: string,
    status: number | null,
    details: readonly string[] = [],
  ) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

async function requestJson<T>(
  path: string,
  schema: z.ZodType<T>,
  init: RequestInit = {},
): Promise<T> {
  const controller = new AbortController()
  const timeoutId = window.setTimeout(
    () => controller.abort(),
    requestTimeoutMs,
  )
  const abortFromCaller = () => controller.abort()
  init.signal?.addEventListener('abort', abortFromCaller, { once: true })

  try {
    const response = await fetch(`${apiBaseUrl}${apiPrefix}${path}`, {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
      },
    })
    const responseBody: unknown = await response.json().catch(() => null)

    if (!response.ok) {
      throw apiErrorFromResponse(response.status, responseBody)
    }

    const parsed = schema.safeParse(responseBody)
    if (!parsed.success) {
      throw new ApiError(
        'La API respondió con un formato inesperado.',
        response.status,
      )
    }
    return parsed.data
  } catch (error) {
    if (error instanceof ApiError) {
      throw error
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ApiError(
        'La solicitud se canceló o excedió el tiempo de espera.',
        null,
      )
    }
    throw new ApiError(
      'No se pudo conectar con la API. Comprueba que el backend esté activo en http://localhost:3000.',
      null,
    )
  } finally {
    window.clearTimeout(timeoutId)
    init.signal?.removeEventListener('abort', abortFromCaller)
  }
}

function apiErrorFromResponse(status: number, body: unknown): ApiError {
  const parsed = z
    .object({
      message: z.union([z.string(), z.array(z.string())]).optional(),
    })
    .safeParse(body)
  const messages = parsed.success
    ? typeof parsed.data.message === 'string'
      ? [parsed.data.message]
      : (parsed.data.message ?? [])
    : []
  return new ApiError(
    messages[0] ?? `La API respondió con el estado HTTP ${status}.`,
    status,
    messages,
  )
}

export const api = {
  getPortfolio(userId: number, signal?: AbortSignal) {
    return requestJson(
      `/users/${userId}/portfolio`,
      portfolioSchema,
      { signal },
    )
  },

  searchInstruments(query: string, signal?: AbortSignal) {
    return requestJson(
      `/instruments?query=${encodeURIComponent(query)}`,
      z.array(instrumentSchema),
      { signal },
    )
  },

  createOrder(userId: number, request: CreateOrderRequest) {
    const body = createOrderRequestSchema.parse(request)
    return requestJson(
      `/users/${userId}/orders`,
      orderSchema,
      { method: 'POST', body: JSON.stringify(body) },
    )
  },

  cancelOrder(userId: number, orderId: number) {
    return requestJson(
      `/users/${userId}/orders/${orderId}/cancel`,
      orderSchema,
      { method: 'PATCH' },
    )
  },
}

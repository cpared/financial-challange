import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from './client'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('API client', () => {
  it('requests portfolio data from the configured backend base URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          userId: 2,
          totalAccountValueArs: 50,
          availableCashArs: 50,
          positions: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(api.getPortfolio(2)).resolves.toMatchObject({
      userId: 2,
      totalAccountValueArs: 50,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'http://localhost:3000/api/v1/users/2/portfolio',
      expect.objectContaining({
        headers: { Accept: 'application/json' },
        signal: expect.any(AbortSignal),
      }),
    )
  })

  it('encodes instrument search terms and sends order payloads to backend routes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify([{ id: 47, ticker: 'BBAR', name: 'Banco', type: 'ACCIONES' }]),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: 10,
            instrumentId: 47,
            userId: 1,
            size: 2,
            price: 10,
            type: 'LIMIT',
            side: 'BUY',
            status: 'NEW',
            datetime: '2026-01-01T10:00:00.000Z',
          }),
          { status: 201 },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    await api.searchInstruments('B B')
    await api.createOrder(1, {
      instrumentId: 47,
      side: 'BUY',
      type: 'LIMIT',
      quantity: 2,
      price: 10,
    })

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'http://localhost:3000/api/v1/instruments?query=B%20B',
    )
    expect(fetchMock.mock.calls[1]).toMatchObject([
      'http://localhost:3000/api/v1/users/1/orders',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          instrumentId: 47,
          side: 'BUY',
          type: 'LIMIT',
          quantity: 2,
          price: 10,
        }),
      }),
    ])
  })

  it('preserves backend status and validation details in API errors', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ message: ['price must be positive'] }), {
          status: 400,
        }),
      ),
    )

    await expect(api.searchInstruments('x')).rejects.toMatchObject({
      status: 400,
      message: 'price must be positive',
      details: ['price must be positive'],
    })
  })
})

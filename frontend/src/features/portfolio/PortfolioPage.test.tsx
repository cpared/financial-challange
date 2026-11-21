import { screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, api } from '../../shared/api/client'
import { renderWithProviders } from '../../test/testUtils'
import { PortfolioPage } from './PortfolioPage'

vi.mock('../../shared/api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../shared/api/client')>()
  return { ...original, api: { ...original.api, getPortfolio: vi.fn() } }
})

const getPortfolioMock = vi.mocked(api.getPortfolio)

afterEach(() => {
  vi.clearAllMocks()
})

describe('PortfolioPage', () => {
  it('shows loading and then renders values returned by the API', async () => {
    let resolvePortfolio: ((value: Awaited<ReturnType<typeof api.getPortfolio>>) => void) | undefined
    getPortfolioMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolvePortfolio = resolve
        }),
    )
    renderWithProviders(<PortfolioPage />)

    expect(screen.getByRole('status')).toHaveTextContent(
      'Consultando portfolio',
    )
    resolvePortfolio?.({
      userId: 1,
      totalAccountValueArs: 2000,
      availableCashArs: 200,
      positions: [
        {
          instrumentId: 47,
          ticker: 'BBAR',
          name: 'Banco',
          quantity: 2,
          marketValueArs: 1800,
          totalReturnArs: 300,
          totalReturnPercent: 20,
          dailyReturnPercent: 1.5,
        },
      ],
    })

    expect(await screen.findByText('BBAR')).toBeInTheDocument()
    expect(screen.getByText(/2\.000,00/)).toBeInTheDocument()
    expect(screen.getByText(/1\.800,00/)).toBeInTheDocument()
    expect(screen.getByText('No disponible')).toBeInTheDocument()
  })

  it('shows backend errors without replacing them with successful-looking data', async () => {
    getPortfolioMock.mockRejectedValue(
      new ApiError(
        'Portfolio data is inconsistent and cannot be calculated.',
        500,
      ),
    )
    renderWithProviders(<PortfolioPage />)

    expect(
      await screen.findByText(
        'Portfolio data is inconsistent and cannot be calculated.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText('Todavía no hay posiciones')).not.toBeInTheDocument()
  })
})

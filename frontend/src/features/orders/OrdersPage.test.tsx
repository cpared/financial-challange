import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Route, Routes } from 'react-router-dom'
import { api } from '../../shared/api/client'
import { renderWithProviders } from '../../test/testUtils'
import { OrdersPage } from './OrdersPage'
import { PortfolioPage } from '../portfolio/PortfolioPage'

vi.mock('../../shared/api/client', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../../shared/api/client')>()
  return {
    ...original,
    api: {
      ...original.api,
      searchInstruments: vi.fn(),
      getPortfolio: vi.fn(),
      createOrder: vi.fn(),
      cancelOrder: vi.fn(),
    },
  }
})

const searchMock = vi.mocked(api.searchInstruments)
const portfolioMock = vi.mocked(api.getPortfolio)
const createMock = vi.mocked(api.createOrder)
const cancelMock = vi.mocked(api.cancelOrder)

afterEach(() => {
  vi.clearAllMocks()
  vi.restoreAllMocks()
})

describe('OrdersPage', () => {
  it('confirms a filled buy and redirects to the portfolio', async () => {
    portfolioMock.mockResolvedValue({
      userId: 2,
      totalAccountValueArs: 100,
      availableCashArs: 0,
      positions: [],
    })
    searchMock.mockResolvedValue([
      { id: 47, ticker: 'BBAR', name: 'Banco Frances', type: 'ACCIONES' },
    ])
    createMock.mockResolvedValue({
      id: 85,
      instrumentId: 47,
      userId: 2,
      size: 1,
      price: 100,
      type: 'MARKET',
      side: 'BUY',
      status: 'FILLED',
      datetime: '2026-01-01T10:00:00.000Z',
    })
    const user = userEvent.setup()
    renderWithProviders(
      <Routes>
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
      </Routes>,
      { initialEntries: ['/orders'] },
    )

    await user.type(screen.getByLabelText('Instrumento'), 'BBAR')
    await user.click(await screen.findByRole('button', { name: /BBAR/ }))
    await user.click(
      screen.getByRole('button', { name: 'Enviar orden al backend' }),
    )

    expect(createMock).toHaveBeenCalledWith(2, {
      instrumentId: 47,
      side: 'BUY',
      type: 'MARKET',
      quantity: 1,
    })
    expect(
      await screen.findByRole('heading', { name: 'Tu portfolio' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Compra exitosa')).toBeInTheDocument()
    expect(
      screen.getByText('La orden #85 se ejecutó correctamente.'),
    ).toBeInTheDocument()
  })

  it('redirects with a pending confirmation for a NEW limit order', async () => {
    portfolioMock.mockResolvedValue({
      userId: 2,
      totalAccountValueArs: 100,
      availableCashArs: 0,
      positions: [],
    })
    searchMock.mockResolvedValue([
      { id: 47, ticker: 'BBAR', name: 'Banco Frances', type: 'ACCIONES' },
    ])
    createMock.mockResolvedValue({
      id: 86,
      instrumentId: 47,
      userId: 2,
      size: 1,
      price: 100,
      type: 'LIMIT',
      side: 'BUY',
      status: 'NEW',
      datetime: '2026-01-01T10:00:00.000Z',
    })
    const user = userEvent.setup()
    renderWithProviders(
      <Routes>
        <Route path="/orders" element={<OrdersPage />} />
        <Route path="/portfolio" element={<PortfolioPage />} />
      </Routes>,
      { initialEntries: ['/orders'] },
    )

    await user.type(screen.getByLabelText('Instrumento'), 'BBAR')
    await user.click(await screen.findByRole('button', { name: /BBAR/ }))
    await user.selectOptions(screen.getByLabelText('Tipo de orden'), 'LIMIT')
    await user.clear(screen.getByLabelText('Precio límite (ARS)'))
    await user.type(screen.getByLabelText('Precio límite (ARS)'), '100')
    await user.click(
      screen.getByRole('button', { name: 'Enviar orden al backend' }),
    )

    expect(await screen.findByText('Orden enviada')).toBeInTheDocument()
    expect(
      screen.getByText('La orden #86 quedó pendiente de ejecución.'),
    ).toBeInTheDocument()
  })

  it('shows a rejected order without reporting success or redirecting', async () => {
    searchMock.mockResolvedValue([
      { id: 47, ticker: 'BBAR', name: 'Banco Frances', type: 'ACCIONES' },
    ])
    createMock.mockResolvedValue({
      id: 87,
      instrumentId: 47,
      userId: 2,
      size: 1,
      price: 100,
      type: 'MARKET',
      side: 'BUY',
      status: 'REJECTED',
      datetime: '2026-01-01T10:00:00.000Z',
    })
    const user = userEvent.setup()
    renderWithProviders(<OrdersPage />, { initialEntries: ['/orders'] })

    await user.type(screen.getByLabelText('Instrumento'), 'BBAR')
    await user.click(await screen.findByRole('button', { name: /BBAR/ }))
    await user.click(
      screen.getByRole('button', { name: 'Enviar orden al backend' }),
    )

    expect(
      await screen.findByRole('heading', { name: 'Compra rechazada' }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Compra exitosa')).not.toBeInTheDocument()
  })

  it('confirms and sends cancellation for a NEW order received in this session', async () => {
    searchMock.mockResolvedValue([
      { id: 47, ticker: 'BBAR', name: 'Banco Frances', type: 'ACCIONES' },
    ])
    createMock.mockResolvedValue({
      id: 85,
      instrumentId: 47,
      userId: 2,
      size: 1,
      price: 10,
      type: 'LIMIT',
      side: 'BUY',
      status: 'NEW',
      datetime: '2026-01-01T10:00:00.000Z',
    })
    cancelMock.mockResolvedValue({
      id: 85,
      instrumentId: 47,
      userId: 2,
      size: 1,
      price: 10,
      type: 'LIMIT',
      side: 'BUY',
      status: 'CANCELLED',
      datetime: '2026-01-01T10:00:00.000Z',
    })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const user = userEvent.setup()
    renderWithProviders(<OrdersPage />, { initialEntries: ['/orders'] })

    await user.type(screen.getByLabelText('Instrumento'), 'BBAR')
    await user.click(await screen.findByRole('button', { name: /BBAR/ }))
    await user.selectOptions(screen.getByLabelText('Tipo de orden'), 'LIMIT')
    await user.clear(screen.getByLabelText('Precio límite (ARS)'))
    await user.type(screen.getByLabelText('Precio límite (ARS)'), '10')
    await user.click(
      screen.getByRole('button', { name: 'Enviar orden al backend' }),
    )

    const activityItem = await screen.findByText('#85 · BUY LIMIT')
    const cancelInActivity = within(
      activityItem.closest('article') as HTMLElement,
    ).getByRole('button', { name: 'Cancelar' })
    await user.click(cancelInActivity)

    expect(window.confirm).toHaveBeenCalledWith('¿Cancelar la orden #85?')
    expect(cancelMock).toHaveBeenCalledWith(2, 85)
    const activityItemRow = screen
      .getByText('#85 · BUY LIMIT')
      .closest('article')
    expect(activityItemRow).not.toBeNull()
    expect(
      within(activityItemRow as HTMLElement).getByText('CANCELLED'),
    ).toBeInTheDocument()
  })
})

import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '../../shared/api/client'
import { renderWithProviders } from '../../test/testUtils'
import { InstrumentsPage } from './InstrumentsPage'

vi.mock('../../shared/api/client', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../shared/api/client')>()
  return { ...original, api: { ...original.api, searchInstruments: vi.fn() } }
})

const searchInstrumentsMock = vi.mocked(api.searchInstruments)

afterEach(() => {
  vi.clearAllMocks()
})

describe('InstrumentsPage', () => {
  it('searches and renders instruments returned by the API', async () => {
    searchInstrumentsMock.mockResolvedValue([
      { id: 47, ticker: 'BBAR', name: 'Banco Frances', type: 'ACCIONES' },
    ])
    const user = userEvent.setup()
    renderWithProviders(<InstrumentsPage />)

    await user.type(screen.getByLabelText('Ticker o nombre'), 'BBAR')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(await screen.findByText('BBAR')).toBeInTheDocument()
    expect(screen.getByText('Banco Frances')).toBeInTheDocument()
    expect(searchInstrumentsMock).toHaveBeenCalledWith('BBAR', expect.anything())
  })

  it('shows an explicit empty state for no API matches', async () => {
    searchInstrumentsMock.mockResolvedValue([])
    const user = userEvent.setup()
    renderWithProviders(<InstrumentsPage />)

    await user.type(screen.getByLabelText('Ticker o nombre'), 'NO_MATCH')
    await user.click(screen.getByRole('button', { name: 'Buscar' }))

    expect(
      await screen.findByText('No se encontraron instrumentos'),
    ).toBeInTheDocument()
  })
})

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { AccountProvider } from '../app/AccountContext'

export function createTestQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
}

export function renderWithProviders(
  ui: ReactElement,
  options: {
    readonly initialEntries?: string[]
    readonly queryClient?: QueryClient
  } = {},
) {
  const queryClient = options.queryClient ?? createTestQueryClient()
  function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={options.initialEntries}>
          <AccountProvider>{children}</AccountProvider>
        </MemoryRouter>
      </QueryClientProvider>
    )
  }
  return { ...render(ui, { wrapper: Wrapper }), queryClient }
}

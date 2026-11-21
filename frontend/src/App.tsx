import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AccountProvider } from './app/AccountContext'
import { AppLayout } from './app/AppLayout'
import { InstrumentsPage } from './features/instruments/InstrumentsPage'
import { OrdersPage } from './features/orders/OrdersPage'
import { PortfolioPage } from './features/portfolio/PortfolioPage'
import './App.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AccountProvider>
          <Routes>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/portfolio" replace />} />
              <Route path="/portfolio" element={<PortfolioPage />} />
              <Route path="/instruments" element={<InstrumentsPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="*" element={<Navigate to="/portfolio" replace />} />
            </Route>
          </Routes>
        </AccountProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}

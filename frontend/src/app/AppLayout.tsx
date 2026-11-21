import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAccount } from './useAccount'

export function AppLayout() {
  const { userId, setUserId } = useAccount()
  const [accountValue, setAccountValue] = useState(String(userId))
  const [accountError, setAccountError] = useState('')

  function applyAccount() {
    const parsed = Number(accountValue)
    if (!Number.isInteger(parsed) || parsed < 1) {
      setAccountError('Ingresa un ID de usuario entero mayor que cero.')
      return
    }
    setAccountError('')
    setUserId(parsed)
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <NavLink className="brand" to="/portfolio" aria-label="Cocos, inicio">
          <span className="brand-mark">C</span>
          <span>
            <strong>cocos</strong>
            <small>API workspace</small>
          </span>
        </NavLink>
        <nav className="main-nav" aria-label="Navegación principal">
          <NavLink to="/portfolio">Portfolio</NavLink>
          <NavLink to="/instruments">Instrumentos</NavLink>
          <NavLink to="/orders">Órdenes</NavLink>
        </nav>
        <div className="account-picker">
          <label htmlFor="account-id">Cuenta API</label>
          <input
            id="account-id"
            inputMode="numeric"
            value={accountValue}
            aria-invalid={Boolean(accountError)}
            aria-describedby={accountError ? 'account-id-error' : undefined}
            onChange={(event) => setAccountValue(event.target.value)}
            onBlur={applyAccount}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                applyAccount()
                event.currentTarget.blur()
              }
            }}
          />
          {accountError && (
            <span className="account-error" id="account-id-error" role="alert">
              {accountError}
            </span>
          )}
        </div>
      </header>
      <main className="page-container">
        <Outlet />
      </main>
      <footer className="app-footer">
        <span>Conectado directamente a la API local</span>
        <code>{import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'}</code>
      </footer>
    </div>
  )
}

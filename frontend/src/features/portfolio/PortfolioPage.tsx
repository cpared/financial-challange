import { useQuery } from '@tanstack/react-query'
import { z } from 'zod'
import { useLocation } from 'react-router-dom'
import { api, ApiError } from '../../shared/api/client'
import { queryKeys } from '../../shared/api/queryKeys'
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from '../../shared/components/Feedback'
import {
  formatArs,
  formatPercent,
  formatQuantity,
} from '../../shared/utils/format'
import { useAccount } from '../../app/useAccount'

const orderConfirmationSchema = z.object({
  title: z.string(),
  message: z.string(),
})

export function PortfolioPage() {
  const { userId } = useAccount()
  const location = useLocation()
  const confirmation = z
    .object({ orderConfirmation: orderConfirmationSchema })
    .safeParse(location.state)
  const portfolioQuery = useQuery({
    queryKey: queryKeys.portfolio(userId),
    queryFn: ({ signal }) => api.getPortfolio(userId, signal),
  })

  return (
    <div className="page-content">
      <section className="page-heading">
        <div>
          <p className="eyebrow">CUENTA {userId}</p>
          <h1>Tu portfolio</h1>
          <p className="page-subtitle">
            Saldos y posiciones informados por el backend.
          </p>
        </div>
        <button
          className="button button-secondary"
          type="button"
          onClick={() => void portfolioQuery.refetch()}
          disabled={portfolioQuery.isFetching}
        >
          Actualizar datos
        </button>
      </section>

      {confirmation.success && (
        <div className="success-card" role="status">
          <div>
            <strong>{confirmation.data.orderConfirmation.title}</strong>
            <p>{confirmation.data.orderConfirmation.message}</p>
          </div>
        </div>
      )}

      {portfolioQuery.isPending && (
        <LoadingState label="Consultando portfolio…" />
      )}
      {portfolioQuery.isError && (
        <ErrorState
          title="El backend no pudo calcular este portfolio"
          message={apiErrorMessage(portfolioQuery.error)}
          onRetry={() => void portfolioQuery.refetch()}
        />
      )}
      {portfolioQuery.isSuccess && (
        <>
          <section className="metric-grid" aria-label="Resumen de cuenta">
            <article className="metric-card metric-primary">
              <span className="metric-label">Patrimonio total</span>
              <strong>
                {formatArs(portfolioQuery.data.totalAccountValueArs)}
              </strong>
              <span className="metric-caption">
                Efectivo contable + valor de posiciones
              </span>
            </article>
            <article className="metric-card">
              <span className="metric-label">Efectivo disponible</span>
              <strong>{formatArs(portfolioQuery.data.availableCashArs)}</strong>
              <span className="metric-caption">
                Descuenta reservas de compras NEW
              </span>
            </article>
            <article className="metric-card">
              <span className="metric-label">Posiciones abiertas</span>
              <strong>{portfolioQuery.data.positions.length}</strong>
              <span className="metric-caption">
                Instrumentos con tenencia FILLED
              </span>
            </article>
          </section>

          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">TENENCIAS</p>
                <h2>Posiciones</h2>
              </div>
              <span className="panel-count">
                {portfolioQuery.data.positions.length} instrumentos
              </span>
            </div>
            {portfolioQuery.data.positions.length === 0 ? (
              <EmptyState title="Todavía no hay posiciones">
                Las tenencias aparecen aquí cuando el backend registra compras
                ejecutadas.
              </EmptyState>
            ) : (
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">Instrumento</th>
                      <th scope="col">Cantidad</th>
                      <th scope="col">Precio unitario</th>
                      <th scope="col">Valor de mercado</th>
                      <th scope="col">Rendimiento total</th>
                      <th scope="col">Variación diaria</th>
                    </tr>
                  </thead>
                  <tbody>
                    {portfolioQuery.data.positions.map((position) => (
                      <tr key={position.instrumentId}>
                        <td>
                          <strong className="ticker">
                            {position.ticker ?? '—'}
                          </strong>
                          <span className="secondary-text">
                            {position.name ?? 'Nombre no disponible'}
                          </span>
                        </td>
                        <td>{formatQuantity(position.quantity)}</td>
                        <td>
                          <span className="not-provided">No disponible</span>
                        </td>
                        <td className="numeric-cell">
                          {formatArs(position.marketValueArs)}
                        </td>
                        <td className={returnTone(position.totalReturnArs)}>
                          <strong>{formatArs(position.totalReturnArs)}</strong>
                          <span className="secondary-text">
                            {formatPercent(position.totalReturnPercent)}
                          </span>
                        </td>
                        <td className={returnTone(position.dailyReturnPercent)}>
                          {formatPercent(position.dailyReturnPercent)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="contract-note">
              La API de portfolio no incluye el precio unitario de mercado; se
              muestran solo los campos que devuelve.
            </p>
          </section>
        </>
      )}
    </div>
  )
}

function apiErrorMessage(error: Error): string {
  return error instanceof ApiError
    ? error.message
    : 'Ocurrió un error inesperado al consultar la API.'
}

function returnTone(value: number | null): string {
  if (value === null || value === 0) {
    return 'numeric-cell'
  }
  return value > 0 ? 'numeric-cell positive' : 'numeric-cell negative'
}

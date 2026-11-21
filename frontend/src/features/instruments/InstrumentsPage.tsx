import { useQuery } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, ApiError } from '../../shared/api/client'
import type { Instrument } from '../../shared/api/contracts'
import { queryKeys } from '../../shared/api/queryKeys'
import { EmptyState, ErrorState, LoadingState } from '../../shared/components/Feedback'

export function InstrumentsPage() {
  const navigate = useNavigate()
  const [input, setInput] = useState('')
  const [query, setQuery] = useState('')
  const searchQuery = useQuery({
    queryKey: queryKeys.instruments(query),
    queryFn: ({ signal }) => api.searchInstruments(query, signal),
    enabled: query.length > 0,
  })

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setQuery(input.trim())
  }

  function startOrder(instrument: Instrument) {
    navigate('/orders', { state: { instrument } })
  }

  return (
    <div className="page-content">
      <section className="page-heading">
        <div>
          <p className="eyebrow">MERCADO</p>
          <h1>Instrumentos</h1>
          <p className="page-subtitle">
            Busca por ticker o nombre usando el catálogo del backend.
          </p>
        </div>
      </section>

      <section className="panel search-panel">
        <form className="search-form" onSubmit={submitSearch}>
          <label className="field-label" htmlFor="instrument-search">
            Ticker o nombre
          </label>
          <div className="search-controls">
            <input
              id="instrument-search"
              type="search"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder="Ej. BBAR o Patagonia"
              required
              minLength={1}
            />
            <button className="button button-primary" type="submit">
              Buscar
            </button>
          </div>
        </form>
      </section>

      {searchQuery.isFetching && <LoadingState label="Buscando instrumentos…" />}
      {searchQuery.isError && (
        <ErrorState
          message={
            searchQuery.error instanceof ApiError
              ? searchQuery.error.message
              : 'No se pudo completar la búsqueda.'
          }
          onRetry={() => void searchQuery.refetch()}
        />
      )}
      {searchQuery.isSuccess && searchQuery.data.length === 0 && (
        <section className="panel">
          <EmptyState title="No se encontraron instrumentos">
            Prueba con otro ticker o parte del nombre.
          </EmptyState>
        </section>
      )}
      {searchQuery.isSuccess && searchQuery.data.length > 0 && (
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">RESULTADOS</p>
              <h2>Coincidencias para “{query}”</h2>
            </div>
            <span className="panel-count">{searchQuery.data.length}</span>
          </div>
          <div className="instrument-list">
            {searchQuery.data.map((instrument) => (
              <article className="instrument-item" key={instrument.id}>
                <div className="instrument-identity">
                  <span className="instrument-symbol">
                    {(instrument.ticker ?? '?').slice(0, 2)}
                  </span>
                  <div>
                    <strong className="ticker">
                      {instrument.ticker ?? 'Ticker no disponible'}
                    </strong>
                    <span className="secondary-text">
                      {instrument.name ?? 'Nombre no disponible'}
                    </span>
                  </div>
                </div>
                <div className="instrument-meta">
                  <span>{instrument.type ?? 'Tipo no disponible'}</span>
                  <span>ID {instrument.id}</span>
                </div>
                <button
                  className="button button-secondary"
                  type="button"
                  onClick={() => startOrder(instrument)}
                >
                  Crear orden
                </button>
              </article>
            ))}
          </div>
          <p className="contract-note">
            El endpoint de búsqueda no devuelve detalle ni datos de mercado.
          </p>
        </section>
      )}
    </div>
  )
}

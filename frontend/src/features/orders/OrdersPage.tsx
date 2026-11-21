import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { FormEvent } from 'react'
import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import type { SubmitHandler } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'
import { z } from 'zod'
import { useAccount } from '../../app/useAccount'
import { api, ApiError } from '../../shared/api/client'
import type {
  CreateOrderRequest,
  Instrument,
  Order,
} from '../../shared/api/contracts'
import { instrumentSchema } from '../../shared/api/contracts'
import { queryKeys } from '../../shared/api/queryKeys'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  StatusBadge,
} from '../../shared/components/Feedback'
import { formatDateTime, formatQuantity } from '../../shared/utils/format'
import { orderFormSchema } from './orderFormSchema'

const routeStateSchema = z.object({ instrument: instrumentSchema })

function selectedInstrumentFromState(state: unknown): Instrument | null {
  const parsed = routeStateSchema.safeParse(state)
  return parsed.success ? parsed.data.instrument : null
}

export function OrdersPage() {
  const { userId } = useAccount()
  const queryClient = useQueryClient()
  const location = useLocation()
  const navigate = useNavigate()
  const [instrumentSearch, setInstrumentSearch] = useState('')
  const [selectedInstrument, setSelectedInstrument] = useState(() =>
    selectedInstrumentFromState(location.state),
  )
  const [manualOrderId, setManualOrderId] = useState('')
  const [cancelFormError, setCancelFormError] = useState('')
  const [recentOrders, setRecentOrders] = useState<Order[]>([])
  const form = useForm({
    resolver: zodResolver(orderFormSchema),
    defaultValues: {
      side: 'BUY' as const,
      type: 'MARKET' as const,
      sizeMode: 'quantity' as const,
      quantity: 1,
      amountArs: undefined,
      price: undefined,
    },
  })
  const side = useWatch({ control: form.control, name: 'side' })
  const type = useWatch({ control: form.control, name: 'type' })
  const sizeMode = useWatch({ control: form.control, name: 'sizeMode' })
  const quantity = useWatch({ control: form.control, name: 'quantity' })
  const amountArs = useWatch({ control: form.control, name: 'amountArs' })
  const price = useWatch({ control: form.control, name: 'price' })
  const searchTerm = instrumentSearch.trim()
  const instrumentsQuery = useQuery({
    queryKey: queryKeys.instruments(searchTerm),
    queryFn: ({ signal }) => api.searchInstruments(searchTerm, signal),
    enabled: searchTerm.length > 0,
  })

  const createMutation = useMutation({
    mutationFn: (request: CreateOrderRequest) =>
      api.createOrder(userId, request),
    onSuccess: async (order) => {
      setRecentOrders((orders) => [order, ...orders])
      await queryClient.invalidateQueries({
        queryKey: queryKeys.portfolio(userId),
      })
      const confirmation = orderConfirmation(order)
      if (confirmation) {
        navigate('/portfolio', {
          state: { orderConfirmation: confirmation },
        })
      }
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (orderId: number) => api.cancelOrder(userId, orderId),
    onSuccess: (updatedOrder) => {
      setRecentOrders((orders) => {
        const exists = orders.some((order) => order.id === updatedOrder.id)
        return exists
          ? orders.map((order) =>
              order.id === updatedOrder.id ? updatedOrder : order,
            )
          : [updatedOrder, ...orders]
      })
      setManualOrderId('')
      setCancelFormError('')
      void queryClient.invalidateQueries({
        queryKey: queryKeys.portfolio(userId),
      })
    },
  })

  const submitOrder: SubmitHandler<z.infer<typeof orderFormSchema>> = (
    values,
  ) => {
    if (selectedInstrument) {
      createMutation.mutate(createRequest(values, selectedInstrument.id))
    }
  }

  function chooseInstrument(instrument: Instrument) {
    setSelectedInstrument(instrument)
    setInstrumentSearch('')
  }

  function cancelOrder(orderId: number) {
    if (!window.confirm(`¿Cancelar la orden #${orderId}?`)) {
      return
    }
    cancelMutation.mutate(orderId)
  }

  function submitManualCancellation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const orderId = Number(manualOrderId)
    if (!Number.isInteger(orderId) || orderId < 1) {
      setCancelFormError('Ingresa un ID de orden válido.')
      return
    }
    cancelOrder(orderId)
  }

  return (
    <div className="page-content">
      <section className="page-heading">
        <div>
          <p className="eyebrow">OPERACIONES · CUENTA {userId}</p>
          <h1>Órdenes</h1>
          <p className="page-subtitle">
            Envía y cancela órdenes a través del backend real.
          </p>
        </div>
      </section>

      <div className="orders-layout">
        <section className="panel order-form-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">NUEVA OPERACIÓN</p>
              <h2>Crear orden</h2>
            </div>
          </div>
          <form onSubmit={form.handleSubmit(submitOrder)} noValidate>
            <div className="field-group">
              <label className="field-label" htmlFor="instrument-search-order">
                Instrumento
              </label>
              {selectedInstrument ? (
                <div className="selected-instrument">
                  <div>
                    <strong>
                      {selectedInstrument.ticker ?? 'Instrumento seleccionado'}
                    </strong>
                    <span>
                      {selectedInstrument.name ?? `ID ${selectedInstrument.id}`}
                    </span>
                  </div>
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => setSelectedInstrument(null)}
                  >
                    Cambiar
                  </button>
                </div>
              ) : (
                <>
                  <input
                    id="instrument-search-order"
                    type="search"
                    value={instrumentSearch}
                    onChange={(event) =>
                      setInstrumentSearch(event.target.value)
                    }
                    placeholder="Busca por ticker o nombre"
                    autoComplete="off"
                  />
                  {instrumentsQuery.isFetching && (
                    <p className="inline-hint">Buscando en el catálogo…</p>
                  )}
                  {instrumentsQuery.isError && (
                    <p className="inline-error">
                      {errorMessage(instrumentsQuery.error)}
                    </p>
                  )}
                  {instrumentsQuery.isSuccess &&
                    instrumentsQuery.data.length === 0 && (
                      <p className="inline-hint">No hay coincidencias.</p>
                    )}
                  {instrumentsQuery.isSuccess &&
                    instrumentsQuery.data.length > 0 && (
                      <ul
                        className="instrument-options"
                        aria-label="Resultados"
                      >
                        {instrumentsQuery.data.map((instrument) => (
                          <li key={instrument.id}>
                            <button
                              type="button"
                              onClick={() => chooseInstrument(instrument)}
                            >
                              <span>
                                <strong>{instrument.ticker ?? '—'}</strong>
                                <small>{instrument.name ?? 'Sin nombre'}</small>
                              </span>
                              <span className="option-type">
                                {instrument.type ?? '—'} · #{instrument.id}
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                </>
              )}
            </div>

            <div className="form-grid">
              <div className="field-group">
                <label className="field-label" htmlFor="order-side">
                  Operación
                </label>
                <select id="order-side" {...form.register('side')}>
                  <option value="BUY">Comprar · BUY</option>
                  <option value="SELL">Vender · SELL</option>
                </select>
              </div>
              <div className="field-group">
                <label className="field-label" htmlFor="order-type">
                  Tipo de orden
                </label>
                <select id="order-type" {...form.register('type')}>
                  <option value="MARKET">Mercado · MARKET</option>
                  <option value="LIMIT">Límite · LIMIT</option>
                </select>
              </div>
            </div>

            <fieldset className="field-group size-mode-field">
              <legend className="field-label">Tamaño de la orden</legend>
              <div className="segmented-control">
                <label>
                  <input
                    type="radio"
                    value="quantity"
                    {...form.register('sizeMode')}
                  />
                  <span>Acciones</span>
                </label>
                <label>
                  <input
                    type="radio"
                    value="amountArs"
                    {...form.register('sizeMode')}
                  />
                  <span>Monto ARS</span>
                </label>
              </div>
            </fieldset>

            <div className="form-grid">
              {sizeMode === 'quantity' ? (
                <div className="field-group">
                  <label className="field-label" htmlFor="order-quantity">
                    Cantidad de acciones
                  </label>
                  <input
                    id="order-quantity"
                    type="number"
                    min="1"
                    step="1"
                    {...form.register('quantity', {
                      setValueAs: parseOptionalNumber,
                    })}
                  />
                  {form.formState.errors.quantity?.message && (
                    <FieldError
                      message={String(form.formState.errors.quantity.message)}
                    />
                  )}
                </div>
              ) : (
                <div className="field-group">
                  <label className="field-label" htmlFor="order-amount">
                    Monto máximo (ARS)
                  </label>
                  <input
                    id="order-amount"
                    type="number"
                    min="0.01"
                    max="99999999.99"
                    step="0.01"
                    {...form.register('amountArs', {
                      setValueAs: parseOptionalNumber,
                    })}
                  />
                  {form.formState.errors.amountArs?.message && (
                    <FieldError
                      message={String(form.formState.errors.amountArs.message)}
                    />
                  )}
                </div>
              )}
              {type === 'LIMIT' && (
                <div className="field-group">
                  <label className="field-label" htmlFor="limit-price">
                    Precio límite (ARS)
                  </label>
                  <input
                    id="limit-price"
                    type="number"
                    min="0.01"
                    max="99999999.99"
                    step="0.01"
                    {...form.register('price', {
                      setValueAs: parseOptionalNumber,
                    })}
                  />
                  {form.formState.errors.price?.message && (
                    <FieldError
                      message={String(form.formState.errors.price.message)}
                    />
                  )}
                </div>
              )}
            </div>

            {type === 'MARKET' && (
              <p className="contract-note">
                El backend determinará el precio MARKET usando la última
                cotización disponible.
              </p>
            )}

            <div className="order-summary">
              <span className="eyebrow">RESUMEN</span>
              <p>
                {side === 'BUY' ? 'Compra' : 'Venta'} · {type}
                {sizeMode === 'quantity' && quantity
                  ? ` · ${formatQuantity(quantity)} acciones`
                  : sizeMode === 'amountArs' && amountArs
                    ? ` · monto máximo ARS ${amountArs}`
                    : ''}
                {type === 'LIMIT' && price ? ` · límite ARS ${price}` : ''}
              </p>
            </div>

            {createMutation.isError && (
              <ErrorState
                title="El backend rechazó la solicitud"
                message={errorMessage(createMutation.error)}
              />
            )}
            {createMutation.isSuccess &&
              createMutation.data.status === 'REJECTED' && (
                <div className="feedback-card feedback-error" role="alert">
                  <div>
                    <h2>
                      {createMutation.data.side === 'SELL'
                        ? 'Venta rechazada'
                        : 'Compra rechazada'}
                    </h2>
                    <p>
                      La orden #{createMutation.data.id} no fue ejecutada por el
                      backend.
                    </p>
                  </div>
                </div>
              )}
            {createMutation.isSuccess &&
              createMutation.data.status !== 'REJECTED' &&
              !orderConfirmation(createMutation.data) && (
                <div className="success-card" role="status">
                  <div>
                    <strong>Orden #{createMutation.data.id} recibida</strong>
                    <p>
                      La API respondió con el estado{' '}
                      <StatusBadge status={createMutation.data.status} />.
                    </p>
                  </div>
                </div>
              )}

            <button
              className="button button-primary button-wide"
              type="submit"
              disabled={createMutation.isPending || !selectedInstrument}
            >
              {createMutation.isPending
                ? 'Enviando orden…'
                : 'Enviar orden al backend'}
            </button>
          </form>
        </section>

        <aside className="panel cancellation-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">ORDEN PENDIENTE</p>
              <h2>Cancelar orden</h2>
            </div>
          </div>
          <p className="body-copy">
            La API no ofrece un endpoint para consultar órdenes. Puedes cancelar
            una orden NEW creada en esta sesión o indicar su ID.
          </p>
          <form
            className="manual-cancel-form"
            onSubmit={submitManualCancellation}
          >
            <label className="field-label" htmlFor="cancel-order-id">
              ID de orden
            </label>
            <div className="search-controls">
              <input
                id="cancel-order-id"
                type="number"
                min="1"
                step="1"
                value={manualOrderId}
                onChange={(event) => setManualOrderId(event.target.value)}
                placeholder="Ej. 25"
              />
              <button
                className="button button-secondary"
                type="submit"
                disabled={cancelMutation.isPending}
              >
                Cancelar
              </button>
            </div>
            {cancelFormError && <FieldError message={cancelFormError} />}
          </form>

          {cancelMutation.isPending && (
            <LoadingState label="Cancelando orden…" />
          )}
          {cancelMutation.isError && (
            <ErrorState
              title="No se pudo cancelar la orden"
              message={errorMessage(cancelMutation.error)}
            />
          )}
          {cancelMutation.isSuccess && (
            <div className="success-card" role="status">
              <strong>Orden #{cancelMutation.data.id}</strong>
              <StatusBadge status={cancelMutation.data.status} />
            </div>
          )}

          <div className="session-activity">
            <div className="panel-heading compact-heading">
              <h3>Actividad de esta sesión</h3>
              <span className="panel-count">{recentOrders.length}</span>
            </div>
            {recentOrders.length === 0 ? (
              <EmptyState title="Sin actividad todavía">
                La API no expone el historial previo de la cuenta.
              </EmptyState>
            ) : (
              <div className="activity-list">
                {recentOrders.map((order) => (
                  <article className="activity-item" key={order.id}>
                    <div className="activity-main">
                      <strong>
                        #{order.id} · {order.side ?? '—'} {order.type ?? ''}
                      </strong>
                      <span>
                        {formatQuantity(order.size)} acciones ·{' '}
                        {formatDateTime(order.datetime)}
                      </span>
                    </div>
                    <div className="activity-actions">
                      <StatusBadge status={order.status} />
                      {order.status === 'NEW' && (
                        <button
                          className="text-button danger-text"
                          type="button"
                          disabled={cancelMutation.isPending}
                          onClick={() => cancelOrder(order.id)}
                        >
                          Cancelar
                        </button>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}

function createRequest(
  values: z.infer<typeof orderFormSchema>,
  instrumentId: number,
): CreateOrderRequest {
  const request = {
    instrumentId,
    side: values.side,
    type: values.type,
    ...(values.sizeMode === 'quantity'
      ? { quantity: values.quantity }
      : { amountArs: values.amountArs }),
    ...(values.type === 'LIMIT' ? { price: values.price } : {}),
  }
  return request
}

function orderConfirmation(
  order: Order,
): { readonly title: string; readonly message: string } | null {
  if (order.status === 'FILLED') {
    const title =
      order.side === 'BUY'
        ? 'Compra exitosa'
        : order.side === 'SELL'
          ? 'Venta exitosa'
          : 'Orden ejecutada'
    return {
      title,
      message: `La orden #${order.id} se ejecutó correctamente.`,
    }
  }
  if (order.status === 'NEW') {
    return {
      title: 'Orden enviada',
      message: `La orden #${order.id} quedó pendiente de ejecución.`,
    }
  }
  return null
}

function parseOptionalNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isNaN(value) ? undefined : value
  }
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined
  }
  const parsed = Number(value)
  return Number.isNaN(parsed) ? undefined : parsed
}

function errorMessage(error: Error): string {
  return error instanceof ApiError
    ? error.message
    : 'Ocurrió un error inesperado al comunicarse con el backend.'
}

function FieldError({ message }: { readonly message: string }) {
  return (
    <span className="field-error" role="alert">
      {message}
    </span>
  )
}

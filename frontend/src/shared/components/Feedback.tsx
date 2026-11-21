import type { ReactNode } from 'react'

export function LoadingState({ label }: { readonly label: string }) {
  return (
    <div className="feedback-card" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  )
}

export function ErrorState({
  title = 'No se pudieron cargar los datos',
  message,
  onRetry,
}: {
  readonly title?: string
  readonly message: string
  readonly onRetry?: () => void
}) {
  return (
    <section className="feedback-card feedback-error" role="alert">
      <div>
        <h2>{title}</h2>
        <p>{message}</p>
      </div>
      {onRetry && (
        <button className="button button-secondary" onClick={onRetry} type="button">
          Reintentar
        </button>
      )}
    </section>
  )
}

export function EmptyState({
  title,
  children,
}: {
  readonly title: string
  readonly children?: ReactNode
}) {
  return (
    <div className="empty-state">
      <span className="empty-mark" aria-hidden="true">
        —
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  )
}

export function StatusBadge({ status }: { readonly status: string | null }) {
  const normalized = status?.toUpperCase() ?? 'DESCONOCIDO'
  return (
    <span className={`status-badge status-${normalized.toLowerCase()}`}>
      {normalized}
    </span>
  )
}

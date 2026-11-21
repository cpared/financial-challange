const arsFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numberFormatter = new Intl.NumberFormat('es-AR', {
  maximumFractionDigits: 4,
})

export function formatArs(value: number | null): string {
  return value === null ? '—' : arsFormatter.format(value)
}

export function formatQuantity(value: number | null): string {
  return value === null ? '—' : numberFormatter.format(value)
}

export function formatPercent(value: number | null): string {
  return value === null ? '—' : `${numberFormatter.format(value)}%`
}

export function formatDateTime(value: string | null): string {
  if (value === null) {
    return '—'
  }
  const date = new Date(value)
  return Number.isNaN(date.getTime())
    ? '—'
    : new Intl.DateTimeFormat('es-AR', {
        dateStyle: 'short',
        timeStyle: 'short',
      }).format(date)
}

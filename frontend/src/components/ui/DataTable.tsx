'use client'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRow = Record<string, any>

interface Column<T = AnyRow> {
  key: string
  label: string
  width?: string
  render?: (value: unknown, row: T) => React.ReactNode
}

interface DataTableProps<T = AnyRow> {
  columns: Column<T>[]
  rows: T[]
  emptyMessage?: string
  emptyIcon?: React.ReactNode
  loading?: boolean
  onRowClick?: (row: T) => void
  ariaLabel?: string
}

export default function DataTable<T extends AnyRow>({
  columns,
  rows,
  emptyMessage = 'No data found',
  emptyIcon,
  loading = false,
  onRowClick,
  ariaLabel,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div style={{ overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    fontSize: '0.72rem',
                    textTransform: 'uppercase',
                    color: 'var(--muted)',
                    letterSpacing: '0.08em',
                    padding: '12px 16px',
                    borderBottom: '1px solid var(--border)',
                    textAlign: 'left',
                    fontWeight: 600,
                    width: col.width,
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <tr key={i}>
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: '14px 16px',
                      borderBottom:
                        i < 4 ? '1px solid var(--border)' : 'none',
                    }}
                  >
                    <div
                      className="animate-pulse"
                      style={{
                        height: '14px',
                        borderRadius: '6px',
                        background: 'rgba(255,255,255,0.06)',
                        width: `${60 + Math.random() * 30}%`,
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center gap-3"
        style={{ padding: '40px 20px' }}
      >
        {emptyIcon && (
          <div
            className="flex items-center justify-center"
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--muted)',
            }}
          >
            {emptyIcon}
          </div>
        )}
        <p style={{ color: 'var(--muted)', fontSize: '0.9rem', margin: 0 }}>
          {emptyMessage}
        </p>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table role="table" aria-label={ariaLabel ?? 'Data table'} style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead role="rowgroup">
          <tr role="row">
            {columns.map((col) => (
              <th
                key={col.key}
                role="columnheader"
                scope="col"
                style={{
                  background: 'rgba(255,255,255,0.03)',
                  fontSize: '0.72rem',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                  letterSpacing: '0.08em',
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                  textAlign: 'left',
                  fontWeight: 600,
                  width: col.width,
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody role="rowgroup">
          {rows.map((row, i) => (
            <tr
              key={i}
              role="row"
              tabIndex={onRowClick ? 0 : undefined}
              className={`data-table-row ${onRowClick ? 'data-table-row-clickable' : ''}`}
              onClick={() => onRowClick?.(row)}
              onKeyDown={onRowClick ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onRowClick(row)
                }
              } : undefined}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    padding: '14px 16px',
                    borderBottom:
                      i < rows.length - 1
                        ? '1px solid var(--border)'
                        : 'none',
                    fontSize: '0.875rem',
                    color: 'var(--text)',
                  }}
                >
                  {col.render
                    ? col.render(row[col.key], row)
                    : (row[col.key] as React.ReactNode)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

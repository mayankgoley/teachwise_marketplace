const statusConfig: Record<string, { bg: string; text: string; label: string }> =
  {
    completed: {
      bg: 'rgba(99,153,34,0.15)',
      text: '#639922',
      label: 'Completed',
    },
    confirmed: {
      bg: 'rgba(79,142,255,0.15)',
      text: '#4f8eff',
      label: 'Confirmed',
    },
    live: { bg: 'rgba(0,229,255,0.15)', text: '#00e5ff', label: 'Live' },
    pending: {
      bg: 'rgba(186,117,23,0.15)',
      text: '#BA7517',
      label: 'Pending',
    },
    cancelled: {
      bg: 'rgba(226,75,74,0.15)',
      text: '#E24B4A',
      label: 'Cancelled',
    },
    rejected: {
      bg: 'rgba(226,75,74,0.15)',
      text: '#E24B4A',
      label: 'Rejected',
    },
    verified: {
      bg: 'rgba(99,153,34,0.15)',
      text: '#639922',
      label: 'Verified',
    },
    under_review: {
      bg: 'rgba(186,117,23,0.15)',
      text: '#BA7517',
      label: 'Under Review',
    },
    pending_documents: {
      bg: 'rgba(127,119,221,0.15)',
      text: '#7F77DD',
      label: 'Pending Docs',
    },
    documents_submitted: {
      bg: 'rgba(79,142,255,0.15)',
      text: '#4f8eff',
      label: 'Docs Submitted',
    },
    assigned: {
      bg: 'rgba(79,142,255,0.15)',
      text: '#4f8eff',
      label: 'Assigned',
    },
    submitted: {
      bg: 'rgba(186,117,23,0.15)',
      text: '#BA7517',
      label: 'Submitted',
    },
    reviewed: {
      bg: 'rgba(99,153,34,0.15)',
      text: '#639922',
      label: 'Reviewed',
    },
    overdue: {
      bg: 'rgba(226,75,74,0.15)',
      text: '#E24B4A',
      label: 'Overdue',
    },
    refunded: {
      bg: 'rgba(127,119,221,0.15)',
      text: '#7F77DD',
      label: 'Refunded',
    },
    open: { bg: 'rgba(226,75,74,0.15)', text: '#E24B4A', label: 'Open' },
    paid: { bg: 'rgba(99,153,34,0.15)', text: '#639922', label: 'Paid' },
  }

interface StatusBadgeProps {
  status: string
}

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    bg: 'rgba(255,255,255,0.08)',
    text: 'var(--muted)',
    label: status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '),
  }

  return (
    <span
      style={{
        background: config.bg,
        color: config.text,
        padding: '4px 10px',
        borderRadius: '100px',
        fontSize: '0.72rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      {config.label}
    </span>
  )
}

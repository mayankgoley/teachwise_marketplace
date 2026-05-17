export default function Loading() {
  return (
    <div style={{ padding: '32px' }}>
      <div className="skeleton" style={{ height: '36px', width: '200px', borderRadius: '8px', marginBottom: '28px' }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '24px' }}>
            <div className="skeleton" style={{ height: '14px', width: '60%', borderRadius: '6px', marginBottom: '12px' }} />
            <div className="skeleton" style={{ height: '32px', width: '50%', borderRadius: '6px' }} />
          </div>
        ))}
      </div>
      {[1,2,3].map(i => (
        <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '24px', marginBottom: '16px' }}>
          <div className="skeleton" style={{ height: '20px', width: '200px', borderRadius: '6px', marginBottom: '16px' }} />
          <div className="skeleton" style={{ height: '220px', width: '100%', borderRadius: '12px' }} />
        </div>
      ))}
    </div>
  )
}

export default function Loading() {
  return (
    <div style={{ padding: '32px' }}>
      <div className="skeleton" style={{ height: '36px', width: '220px', borderRadius: '8px', marginBottom: '8px' }} />
      <div className="skeleton" style={{ height: '16px', width: '300px', borderRadius: '6px', marginBottom: '28px' }} />
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[1,2,3,4].map(i => (
          <div key={i} className="skeleton" style={{ height: '36px', width: '100px', borderRadius: '100px' }} />
        ))}
      </div>
      {[1,2,3].map(i => (
        <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', marginBottom: '12px', display: 'flex', gap: '16px' }}>
          <div className="skeleton" style={{ width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: '18px', width: '55%', borderRadius: '6px', marginBottom: '10px' }} />
            <div className="skeleton" style={{ height: '14px', width: '35%', borderRadius: '6px' }} />
          </div>
          <div className="skeleton" style={{ height: '32px', width: '80px', borderRadius: '100px', alignSelf: 'center' }} />
        </div>
      ))}
    </div>
  )
}

export default function Loading() {
  return (
    <div style={{ display: 'flex', height: 'calc(100vh - 64px)' }}>
      <div style={{ width: '320px', borderRight: '1px solid var(--border)', padding: '16px' }}>
        <div className="skeleton" style={{ height: '40px', width: '100%', borderRadius: '10px', marginBottom: '16px' }} />
        {[1,2,3,4].map(i => (
          <div key={i} style={{ display: 'flex', gap: '12px', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div className="skeleton" style={{ width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div className="skeleton" style={{ height: '15px', width: '70%', borderRadius: '6px', marginBottom: '6px' }} />
              <div className="skeleton" style={{ height: '12px', width: '90%', borderRadius: '6px' }} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="skeleton" style={{ height: '20px', width: '200px', borderRadius: '6px' }} />
      </div>
    </div>
  )
}

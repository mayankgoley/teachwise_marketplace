export default function Loading() {
  return (
    <div style={{ padding: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div className="skeleton" style={{ height: '36px', width: '200px', borderRadius: '8px' }} />
        <div className="skeleton" style={{ height: '36px', width: '120px', borderRadius: '100px' }} />
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        <div className="skeleton" style={{ height: '36px', width: '80px', borderRadius: '100px' }} />
        <div className="skeleton" style={{ height: '36px', width: '110px', borderRadius: '100px' }} />
      </div>
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{ display: 'flex', gap: '14px', padding: '16px', borderBottom: '1px solid var(--border)', alignItems: 'flex-start' }}>
          <div className="skeleton" style={{ width: '8px', height: '8px', borderRadius: '50%', marginTop: '6px', flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: '16px', width: '60%', borderRadius: '6px', marginBottom: '8px' }} />
            <div className="skeleton" style={{ height: '13px', width: '80%', borderRadius: '6px' }} />
          </div>
          <div className="skeleton" style={{ height: '12px', width: '50px', borderRadius: '6px', flexShrink: 0 }} />
        </div>
      ))}
    </div>
  )
}

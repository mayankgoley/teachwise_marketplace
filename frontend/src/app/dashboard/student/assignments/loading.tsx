export default function Loading() {
  return (
    <div style={{ padding: '32px' }}>
      <div className="skeleton" style={{ height: '36px', width: '220px', borderRadius: '8px', marginBottom: '28px' }} />
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
        {[1,2,3,4,5].map(i => (
          <div key={i} className="skeleton" style={{ height: '36px', width: '90px', borderRadius: '100px' }} />
        ))}
      </div>
      {[1,2,3].map(i => (
        <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px', marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div className="skeleton" style={{ height: '20px', width: '50%', borderRadius: '6px' }} />
            <div className="skeleton" style={{ height: '24px', width: '80px', borderRadius: '100px' }} />
          </div>
          <div className="skeleton" style={{ height: '14px', width: '70%', borderRadius: '6px', marginBottom: '8px' }} />
          <div className="skeleton" style={{ height: '14px', width: '40%', borderRadius: '6px' }} />
        </div>
      ))}
    </div>
  )
}

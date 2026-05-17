export default function Loading() {
  return (
    <div style={{ padding: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '28px' }}>
        <div className="skeleton" style={{ height: '36px', width: '200px', borderRadius: '8px' }} />
        <div style={{ display: 'flex', gap: '10px' }}>
          <div className="skeleton" style={{ height: '36px', width: '130px', borderRadius: '100px' }} />
          <div className="skeleton" style={{ height: '36px', width: '100px', borderRadius: '100px' }} />
        </div>
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '24px', marginBottom: '24px' }}>
        <div className="skeleton" style={{ height: '20px', width: '180px', borderRadius: '6px', marginBottom: '16px' }} />
        <div className="skeleton" style={{ height: '200px', width: '100%', borderRadius: '12px' }} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
        {[1,2].map(i => (
          <div key={i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '24px' }}>
            <div className="skeleton" style={{ height: '20px', width: '70%', borderRadius: '6px', marginBottom: '12px' }} />
            <div className="skeleton" style={{ height: '14px', width: '50%', borderRadius: '6px', marginBottom: '20px' }} />
            <div className="skeleton" style={{ height: '16px', width: '80%', borderRadius: '6px', marginBottom: '8px' }} />
            <div className="skeleton" style={{ height: '14px', width: '60%', borderRadius: '6px' }} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Loading() {
  return (
    <div style={{ padding: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '24px' }}>
        <div>
          <div className="skeleton" style={{ height: '36px', width: '180px', borderRadius: '8px', marginBottom: '8px' }} />
          <div className="skeleton" style={{ height: '16px', width: '240px', borderRadius: '6px' }} />
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div className="skeleton" style={{ height: '40px', width: '120px', borderRadius: '100px' }} />
          <div className="skeleton" style={{ height: '40px', width: '110px', borderRadius: '100px' }} />
        </div>
      </div>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        {[1,2,3].map(i => (
          <div key={i} className="skeleton" style={{ height: '24px', width: '80px', borderRadius: '6px' }} />
        ))}
      </div>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="skeleton" style={{ height: '36px', width: '36px', borderRadius: '8px' }} />
            <div className="skeleton" style={{ height: '36px', width: '36px', borderRadius: '8px' }} />
            <div className="skeleton" style={{ height: '36px', width: '80px', borderRadius: '8px' }} />
          </div>
          <div className="skeleton" style={{ height: '24px', width: '180px', borderRadius: '6px' }} />
          <div style={{ display: 'flex', gap: '8px' }}>
            <div className="skeleton" style={{ height: '36px', width: '80px', borderRadius: '8px' }} />
            <div className="skeleton" style={{ height: '36px', width: '80px', borderRadius: '8px' }} />
            <div className="skeleton" style={{ height: '36px', width: '60px', borderRadius: '8px' }} />
          </div>
        </div>
        <div className="skeleton" style={{ height: '500px', width: '100%', borderRadius: '12px' }} />
      </div>
    </div>
  )
}

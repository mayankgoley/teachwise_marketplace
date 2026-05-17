export default function Loading() {
  return (
    <div style={{ padding: '32px' }}>
      <div className="skeleton" style={{ height: '36px', width: '160px', borderRadius: '8px', marginBottom: '28px' }} />
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '20px', padding: '40px', textAlign: 'center' as const, marginBottom: '24px' }}>
        <div className="skeleton" style={{ height: '20px', width: '120px', borderRadius: '6px', margin: '0 auto 12px' }} />
        <div className="skeleton" style={{ height: '56px', width: '200px', borderRadius: '8px', margin: '0 auto 16px' }} />
        <div className="skeleton" style={{ height: '44px', width: '160px', borderRadius: '100px', margin: '0 auto' }} />
      </div>
      <div className="skeleton" style={{ height: '24px', width: '180px', borderRadius: '6px', marginBottom: '16px' }} />
      {[1,2,3,4,5].map(i => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
          <div className="skeleton" style={{ height: '16px', width: '30%', borderRadius: '6px' }} />
          <div className="skeleton" style={{ height: '16px', width: '20%', borderRadius: '6px' }} />
        </div>
      ))}
    </div>
  )
}

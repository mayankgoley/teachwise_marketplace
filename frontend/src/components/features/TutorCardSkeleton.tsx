export default function TutorCardSkeleton() {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: '20px',
        overflow: 'hidden',
      }}
    >
      <div style={{ padding: '20px' }}>
        {/* Avatar + Name row */}
        <div className="flex items-center gap-3 mb-4">
          <div
            className="animate-pulse"
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'rgba(255,255,255,0.06)',
              flexShrink: 0,
            }}
          />
          <div className="flex-1">
            <div
              className="animate-pulse"
              style={{
                height: '16px',
                width: '60%',
                borderRadius: '8px',
                background: 'rgba(255,255,255,0.06)',
                marginBottom: '8px',
              }}
            />
            <div
              className="animate-pulse"
              style={{
                height: '12px',
                width: '40%',
                borderRadius: '6px',
                background: 'rgba(255,255,255,0.06)',
              }}
            />
          </div>
        </div>

        {/* Subject pills */}
        <div className="flex gap-2 mb-3">
          <div
            className="animate-pulse"
            style={{
              height: '24px',
              width: '80px',
              borderRadius: '100px',
              background: 'rgba(255,255,255,0.06)',
            }}
          />
          <div
            className="animate-pulse"
            style={{
              height: '24px',
              width: '60px',
              borderRadius: '100px',
              background: 'rgba(255,255,255,0.06)',
            }}
          />
        </div>

        {/* Bio */}
        <div
          className="animate-pulse"
          style={{
            height: '14px',
            width: '90%',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.06)',
            marginBottom: '6px',
          }}
        />
        <div
          className="animate-pulse"
          style={{
            height: '14px',
            width: '70%',
            borderRadius: '6px',
            background: 'rgba(255,255,255,0.06)',
            marginBottom: '12px',
          }}
        />

        {/* Stats row */}
        <div className="flex gap-4 mb-3">
          <div
            className="animate-pulse"
            style={{
              height: '14px',
              width: '60px',
              borderRadius: '6px',
              background: 'rgba(255,255,255,0.06)',
            }}
          />
          <div
            className="animate-pulse"
            style={{
              height: '14px',
              width: '80px',
              borderRadius: '6px',
              background: 'rgba(255,255,255,0.06)',
            }}
          />
        </div>

        {/* Mode badges */}
        <div className="flex gap-2">
          <div
            className="animate-pulse"
            style={{
              height: '22px',
              width: '60px',
              borderRadius: '100px',
              background: 'rgba(255,255,255,0.06)',
            }}
          />
        </div>
      </div>

      {/* Bottom section */}
      <div
        style={{
          borderTop: '1px solid var(--border)',
          padding: '16px 20px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div
          className="animate-pulse"
          style={{
            height: '24px',
            width: '80px',
            borderRadius: '8px',
            background: 'rgba(255,255,255,0.06)',
          }}
        />
        <div
          className="animate-pulse"
          style={{
            height: '36px',
            width: '100px',
            borderRadius: '100px',
            background: 'rgba(255,255,255,0.06)',
          }}
        />
      </div>
    </div>
  )
}

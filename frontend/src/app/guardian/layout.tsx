import StarCanvas from '@/components/ui/StarCanvas'

export default function GuardianLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <StarCanvas />

      {/* Aurora orbs */}
      <div
        className="fixed rounded-full pointer-events-none z-0 opacity-[0.35] animate-drift w-[600px] h-[600px] -top-[200px] -left-[100px]"
        style={{
          background: 'radial-gradient(circle, #4f8eff, transparent 70%)',
          filter: 'blur(120px)',
        }}
        aria-hidden="true"
      />
      <div
        className="fixed rounded-full pointer-events-none z-0 opacity-[0.35] animate-drift w-[500px] h-[500px] -bottom-[100px] -right-[100px]"
        style={{
          background: 'radial-gradient(circle, #ff4fd8, transparent 70%)',
          filter: 'blur(120px)',
          animationDelay: '-7s',
        }}
        aria-hidden="true"
      />

      <div className="relative z-10 min-h-screen flex items-center justify-center py-20 px-6">
        <div className="w-full max-w-[480px]">{children}</div>
      </div>
    </>
  )
}

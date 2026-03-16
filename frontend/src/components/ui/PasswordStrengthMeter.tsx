import { validatePassword } from '@/lib/auth-utils'

const COLORS = ['#E24B4A', '#BA7517', '#EF9F27', '#639922']
const LABELS = ['Weak', 'Fair', 'Good', 'Strong']

interface PasswordStrengthMeterProps {
  password: string
}

export default function PasswordStrengthMeter({
  password,
}: PasswordStrengthMeterProps) {
  if (password.length === 0) return null

  const { score } = validatePassword(password)

  return (
    <div className="mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-colors duration-200"
            style={{
              backgroundColor:
                i < score
                  ? COLORS[score - 1]
                  : 'rgba(255,255,255,0.08)',
            }}
          />
        ))}
      </div>
      <p
        className="text-[0.75rem] mt-1"
        style={{ color: COLORS[score - 1] ?? 'var(--muted)' }}
      >
        {score > 0 ? LABELS[score - 1] : ''}
      </p>
    </div>
  )
}

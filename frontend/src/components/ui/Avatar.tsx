import Image from 'next/image'

const gradients = [
  'linear-gradient(135deg, #4f8eff, #00e5ff)',
  'linear-gradient(135deg, #ff4fd8, #4f8eff)',
  'linear-gradient(135deg, #00e5ff, #639922)',
  'linear-gradient(135deg, #7F77DD, #ff4fd8)',
  'linear-gradient(135deg, #BA7517, #E24B4A)',
  'linear-gradient(135deg, #639922, #00e5ff)',
]

const sizes = { xs: 24, sm: 32, md: 44, lg: 64, xl: 96 }
const fontSizes = { xs: '0.55rem', sm: '0.7rem', md: '0.9rem', lg: '1.3rem', xl: '2rem' }

function getGradient(name: string): string {
  const hash = name
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)
  return gradients[hash % gradients.length]
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0][0].toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

interface AvatarProps {
  name: string
  avatarUrl?: string | null
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}

export default function Avatar({
  name,
  avatarUrl,
  size = 'md',
  className = '',
}: AvatarProps) {
  const px = sizes[size]

  if (avatarUrl) {
    return (
      <Image
        src={avatarUrl}
        alt={name}
        width={px}
        height={px}
        className={`rounded-full object-cover flex-shrink-0 ${className}`}
        style={{ width: px, height: px }}
      />
    )
  }

  return (
    <div
      className={`flex items-center justify-center rounded-full flex-shrink-0 font-semibold text-white ${className}`}
      style={{
        width: px,
        height: px,
        background: getGradient(name),
        fontSize: fontSizes[size],
      }}
    >
      {getInitials(name)}
    </div>
  )
}

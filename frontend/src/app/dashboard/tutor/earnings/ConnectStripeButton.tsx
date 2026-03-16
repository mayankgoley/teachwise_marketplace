'use client'

interface ConnectStripeButtonProps {
  onboardingUrl: string
}

export default function ConnectStripeButton({ onboardingUrl }: ConnectStripeButtonProps) {
  return (
    <a
      href={onboardingUrl}
      className="btn-gradient text-white no-underline flex-shrink-0"
      style={{
        padding: '10px 24px',
        borderRadius: '100px',
        fontSize: '0.875rem',
        fontWeight: 600,
        whiteSpace: 'nowrap',
        display: 'inline-block',
      }}
    >
      Set Up Payouts &rarr;
    </a>
  )
}

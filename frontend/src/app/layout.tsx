import type { Metadata, Viewport } from 'next'
import { Cormorant_Garamond, DM_Sans } from 'next/font/google'
import { ThemeProvider } from '@/context/ThemeContext'
import { AuthProvider } from '@/context/AuthContext'
import { ToastProvider } from '@/context/ToastContext'
import SkipToContent from '@/components/ui/SkipToContent'
import './globals.css'

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['300', '400', '600', '700'],
  style: ['normal', 'italic'],
  display: 'swap',
  preload: true,
  variable: '--font-head',
})

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['300', '400', '500'],
  style: ['normal', 'italic'],
  display: 'swap',
  preload: true,
  variable: '--font-body',
})

export const metadata: Metadata = {
  title: {
    default: 'Teachwise \u2014 Find Expert Tutors',
    template: '%s | Teachwise',
  },
  description:
    'Connect with expert tutors, master any subject, and achieve your academic goals. 24,000+ students helped across 850+ topics.',
  keywords: ['tutoring', 'online tutor', 'find tutor', 'academic help', 'private tutor'],
  authors: [{ name: 'Teachwise' }],
  creator: 'Teachwise',
  metadataBase: new URL('https://teachwiseedu.com'),
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://teachwiseedu.com',
    siteName: 'Teachwise',
    title: 'Teachwise \u2014 Find Expert Tutors',
    description:
      'Connect with expert tutors, master any subject, and achieve your academic goals.',
    images: [{ url: '/og-image.jpg', width: 1200, height: 630, alt: 'Teachwise' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Teachwise \u2014 Find Expert Tutors',
    description:
      'Connect with expert tutors, master any subject, and achieve your academic goals.',
    images: ['/og-image.jpg'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true },
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#03040a' },
    { media: '(prefers-color-scheme: light)', color: '#f4f6fb' },
  ],
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className={`dark ${cormorant.variable} ${dmSans.variable}`} suppressHydrationWarning>
      <body className="font-body antialiased">
        <SkipToContent />
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}

import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import '@/styles/tokens.css'
import '@/styles/app.css'

const inter = Inter({ subsets: ['latin', 'cyrillic'], variable: '--font-sans', display: 'swap' })

export const metadata: Metadata = {
  title: 'MoneyMap',
  description: 'Семейный план денег',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: [{ media: '(prefers-color-scheme: light)', color: '#f4f6fb' }, { media: '(prefers-color-scheme: dark)', color: '#0a1020' }],
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru" className={inter.variable}><body>{children}</body></html>
}

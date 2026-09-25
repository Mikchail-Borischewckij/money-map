import type { Metadata } from 'next'
import '../src/index.css'
import '../src/App.css'

export const metadata: Metadata = {
  title: 'MoneyMap',
  description: 'Семейный план денег',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="ru"><body>{children}</body></html>
}

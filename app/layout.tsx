import './globals.css'
import type { Metadata } from 'next'
import { AppProvider } from '@/context/AppContext'
import { CookieConsentProvider, CookieConsentBanner } from '@/components/CookieConsent'

export const metadata: Metadata = {
  title: 'Dhurdur | Preview',
  description: 'Where Style Meets Craft',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="de" className="scroll-smooth">
      <body>
        <CookieConsentProvider>
          <AppProvider>
            {children}
            <CookieConsentBanner />
          </AppProvider>
        </CookieConsentProvider>
      </body>
    </html>
  )
}
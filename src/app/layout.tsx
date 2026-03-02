import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'LoopArchitect - Music Production Platform',
  description: 'Preview and download high-quality instrumentals for your music projects',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
        {children}
      </body>
    </html>
  )
}

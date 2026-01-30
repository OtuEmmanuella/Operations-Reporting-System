import './globals.css'
import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Operations Reporting System',
  description: 'Sales and inventory management system',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
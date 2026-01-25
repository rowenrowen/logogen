import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'SVG Logo Generator',
  description: 'Generate icon-only SVG logos from text prompts',
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

import type React from "react"
import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/toaster"
import { Analytics } from "@vercel/analytics/react"
import { Suspense } from "react"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "WWDC25 Live Tracker",
  description: "Real-time updates from Apple's Worldwide Developers Conference 2025",
  keywords: ["WWDC25", "Apple", "Developer Conference", "iOS 19", "macOS 15", "Live Updates"],
  authors: [{ name: "educalvolpz", url: "https://x.com/educalvolpz" }],
  creator: "educalvolpz",
  openGraph: {
    title: "WWDC25 Live Tracker",
    description: "Real-time updates from Apple's Worldwide Developers Conference 2025",
    url: "https://apple-wwdc-25.vercel.app/",
    siteName: "WWDC25 Live Tracker",
    type: "website",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "WWDC25 Live Tracker",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "WWDC25 Live Tracker",
    description: "Real-time updates from Apple's Worldwide Developers Conference 2025",
    creator: "@educalvolpz",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
    generator: 'v0.dev'
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="manifest" href="/site.webmanifest" />
        <meta name="theme-color" content="#ffffff" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body className={inter.className}>
        <Suspense fallback={null}>
          <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
            {children}
            <Toaster />
            <Analytics />
          </ThemeProvider>
        </Suspense>
      </body>
    </html>
  )
}

import type { Metadata, Viewport } from "next"
import { Poppins, Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { ThemeScript } from "@/components/providers/theme-script"
import { QueryProvider } from "@/components/providers/query-provider"
import { ErrorBoundary } from "@/components/error-boundary"
import { ConfirmProvider } from "@/components/confirm-dialog"
import { Toaster } from "sonner"
import { COMPANY_CONFIG } from "@/lib/config"

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-poppins",
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: `${COMPANY_CONFIG.name} Command Center`,
  description: `Event Management Platform for ${COMPANY_CONFIG.fullName}`,
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${poppins.variable} ${inter.variable}`}>
      <head>
        <ThemeScript />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content={COMPANY_CONFIG.name} />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="theme-color" content="#7c3aed" />
      </head>
      <body className="font-poppins antialiased overflow-x-hidden">
        <QueryProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="light"
            enableSystem
          >
            <ConfirmProvider>
              <ErrorBoundary>
                {children}
              </ErrorBoundary>
            </ConfirmProvider>
            <Toaster position="top-right" richColors closeButton />
          </ThemeProvider>
        </QueryProvider>
      </body>
    </html>
  )
}

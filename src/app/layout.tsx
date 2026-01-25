import type { Metadata } from "next"
import { Poppins, Inter } from "next/font/google"
import "./globals.css"
import { ThemeProvider } from "@/components/providers/theme-provider"
import { ThemeScript } from "@/components/providers/theme-script"
import { QueryProvider } from "@/components/providers/query-provider"
import { ErrorBoundary } from "@/components/error-boundary"
import { ConfirmProvider } from "@/components/confirm-dialog"
import { Toaster } from "sonner"

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
  title: "AMASI Command Center",
  description: "Faculty Management System for Association of Minimal Access Surgeons of India",
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
      </head>
      <body className="font-poppins antialiased">
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

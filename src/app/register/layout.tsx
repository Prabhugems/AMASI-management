"use client"

import { useEffect } from "react"

export default function RegisterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Force light mode for public registration pages
  useEffect(() => {
    document.documentElement.classList.remove("dark")
    document.documentElement.style.colorScheme = "light"
  }, [])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white font-bold text-lg">
              A
            </div>
            <div>
              <h1 className="font-bold text-gray-900">AMASI</h1>
              <p className="text-xs text-gray-500">Events</p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="pb-12">{children}</main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-gray-500">
          <p>&copy; {new Date().getFullYear()} AMASI. All rights reserved.</p>
          <div className="flex justify-center gap-4 mt-2">
            <a href="#" className="hover:text-gray-700">Terms of Service</a>
            <a href="#" className="hover:text-gray-700">Privacy Policy</a>
            <a href="#" className="hover:text-gray-700">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  )
}

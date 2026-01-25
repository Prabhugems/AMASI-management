"use client"

import * as React from "react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import type { ThemeColor } from "@/lib/types"

type ThemeProviderProps = React.ComponentProps<typeof NextThemesProvider>

export type SidebarColor = "brown" | "blue" | "green" | "purple" | "orange" | "red"

const ThemeColorContext = React.createContext<{
  color: ThemeColor
  setColor: (color: ThemeColor) => void
  sidebarColor: SidebarColor
  setSidebarColor: (color: SidebarColor) => void
}>({
  color: "violet",
  setColor: () => {},
  sidebarColor: "brown",
  setSidebarColor: () => {},
})

export function useThemeColor() {
  const context = React.useContext(ThemeColorContext)
  if (!context) {
    throw new Error("useThemeColor must be used within a ThemeProvider")
  }
  return context
}

// Helper to get initial value from localStorage (client-side only)
function getStoredThemeColor(): ThemeColor {
  if (typeof window === "undefined") return "violet"
  return (localStorage.getItem("theme-color") as ThemeColor) || "violet"
}

function getStoredSidebarColor(): SidebarColor {
  if (typeof window === "undefined") return "brown"
  return (localStorage.getItem("sidebar-color") as SidebarColor) || "brown"
}

export function ThemeProvider({ children, ...props }: ThemeProviderProps) {
  // Initialize with stored values to prevent flash
  const [color, setColorState] = React.useState<ThemeColor>(() => getStoredThemeColor())
  const [sidebarColor, setSidebarColorState] = React.useState<SidebarColor>(() => getStoredSidebarColor())
  const [mounted, setMounted] = React.useState(false)

  React.useEffect(() => {
    setMounted(true)
    // Sync state with localStorage on mount (classes already applied by ThemeScript)
    const savedColor = localStorage.getItem("theme-color") as ThemeColor
    const savedSidebarColor = localStorage.getItem("sidebar-color") as SidebarColor

    if (savedColor) {
      setColorState(savedColor)
    }
    if (savedSidebarColor) {
      setSidebarColorState(savedSidebarColor)
    }
  }, [])

  const setColor = React.useCallback((newColor: ThemeColor) => {
    setColorState(newColor)
    localStorage.setItem("theme-color", newColor)
    applyThemeColor(newColor)
  }, [])

  const setSidebarColor = React.useCallback((newColor: SidebarColor) => {
    setSidebarColorState(newColor)
    localStorage.setItem("sidebar-color", newColor)
    applySidebarColor(newColor)
  }, [])

  return (
    <NextThemesProvider {...props}>
      <ThemeColorContext.Provider value={{ color, setColor, sidebarColor, setSidebarColor }}>
        {children}
      </ThemeColorContext.Provider>
    </NextThemesProvider>
  )
}

// Apply theme color class to html element
function applyThemeColor(themeColor: ThemeColor) {
  const root = document.documentElement
  // Remove all theme color classes
  const themeClasses = ["theme-violet", "theme-blue", "theme-green", "theme-rose", "theme-amber", "theme-cyan", "theme-orange"]
  root.classList.remove(...themeClasses)
  // Add new theme color class (violet is default, no class needed)
  if (themeColor !== "violet") {
    root.classList.add(`theme-${themeColor}`)
  }
}

// Apply sidebar color class to html element
function applySidebarColor(sidebarColor: SidebarColor) {
  const root = document.documentElement
  // Remove all sidebar color classes
  const sidebarClasses = ["sidebar-brown", "sidebar-blue", "sidebar-green", "sidebar-purple", "sidebar-orange", "sidebar-red"]
  root.classList.remove(...sidebarClasses)
  // Add new sidebar color class
  root.classList.add(`sidebar-${sidebarColor}`)
}

// Theme color options for the color picker
export const themeColors: { value: ThemeColor; label: string; class: string }[] = [
  { value: "violet", label: "Violet", class: "bg-violet-500" },
  { value: "blue", label: "Blue", class: "bg-blue-500" },
  { value: "green", label: "Green", class: "bg-green-500" },
  { value: "rose", label: "Rose", class: "bg-rose-500" },
  { value: "amber", label: "Amber", class: "bg-amber-500" },
  { value: "cyan", label: "Cyan", class: "bg-cyan-500" },
  { value: "orange", label: "Orange", class: "bg-orange-500" },
]

// Sidebar color options (Paper Dashboard Pro style)
export const sidebarColors: { value: SidebarColor; label: string; class: string }[] = [
  { value: "brown", label: "Brown", class: "bg-[#4c3228]" },
  { value: "blue", label: "Blue", class: "bg-[#1a365d]" },
  { value: "green", label: "Green", class: "bg-[#1c4532]" },
  { value: "purple", label: "Purple", class: "bg-[#44337a]" },
  { value: "orange", label: "Orange", class: "bg-[#7b341e]" },
  { value: "red", label: "Red", class: "bg-[#742a2a]" },
]

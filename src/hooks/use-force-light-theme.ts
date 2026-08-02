import { useEffect } from "react"
import { useTheme } from "next-themes"

// Kiosk tablets are shared, walk-up devices under bright hall lighting --
// there is no per-user theme preference to respect, and the app-wide
// default is dark (src/app/layout.tsx), which loses contrast under glare
// (work order §2.4). Forces this browser instance to light regardless of
// the site-wide default or any previously-stored preference; harmless to
// call from more than one component in the same tree.
export function useForceLightTheme() {
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    if (theme !== "light") setTheme("light")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

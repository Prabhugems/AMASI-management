// This script runs before React hydration to prevent theme flash
export function ThemeScript() {
  const themeScript = `
    (function() {
      try {
        // Force dark mode — add class early to prevent flash
        document.documentElement.classList.add('dark');
        document.documentElement.style.colorScheme = 'dark';

        // Migrate any existing light-mode preference to dark
        var storedTheme = localStorage.getItem('theme');
        if (!storedTheme || storedTheme === 'light' || storedTheme === 'system') {
          localStorage.setItem('theme', 'dark');
        }

        // Apply theme color
        var themeColor = localStorage.getItem('theme-color');
        if (themeColor && themeColor !== 'violet') {
          document.documentElement.classList.add('theme-' + themeColor);
        }

        // Apply sidebar color
        var sidebarColor = localStorage.getItem('sidebar-color');
        if (sidebarColor) {
          document.documentElement.classList.add('sidebar-' + sidebarColor);
        } else {
          document.documentElement.classList.add('sidebar-brown');
        }
      } catch (e) {
        console.error('Theme script error:', e);
      }
    })();
  `;

  return (
    <script
      dangerouslySetInnerHTML={{ __html: themeScript }}
      suppressHydrationWarning
    />
  );
}

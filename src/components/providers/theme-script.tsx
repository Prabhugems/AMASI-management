// This script runs before React hydration to prevent theme flash
export function ThemeScript() {
  const themeScript = `
    (function() {
      try {
        // Resolve the stored theme preference early to prevent a flash.
        // Defaults to dark (Pocket theme) only when nothing is stored yet —
        // an explicit light/system choice must survive reloads.
        var storedTheme = localStorage.getItem('theme');
        var isDark;
        if (storedTheme === 'light') {
          isDark = false;
        } else if (storedTheme === 'dark') {
          isDark = true;
        } else if (storedTheme === 'system') {
          isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        } else {
          isDark = true;
        }

        if (isDark) {
          document.documentElement.classList.add('dark');
          document.documentElement.style.colorScheme = 'dark';
        } else {
          document.documentElement.classList.remove('dark');
          document.documentElement.style.colorScheme = 'light';
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

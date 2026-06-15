// Runs before paint to set the theme class, avoiding a light/dark flash.
// Reads localStorage('theme') then falls back to the OS preference.
const script = `(() => {
  try {
    const stored = localStorage.getItem('theme');
    const system = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = stored ? stored === 'dark' : system;
    document.documentElement.classList.toggle('dark', dark);
  } catch (_) {}
})();`;

export function ThemeScript() {
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}

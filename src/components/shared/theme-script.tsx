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
  // On the server emit a runnable script (executes during HTML parse, before
  // paint — preventing the theme flash). On the client emit an inert text/plain
  // tag so React doesn't warn about rendering a <script>; suppressHydrationWarning
  // covers the type attribute mismatch. Per Next.js "preventing flash" guide.
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: script }}
    />
  );
}

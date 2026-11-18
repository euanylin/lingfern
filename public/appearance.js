// Restore presentation before styles and public prerendered content can paint.
(() => {
  let mode = 'system', palette = 'basic', cached = false;
  try {
    const saved = JSON.parse(localStorage.getItem('lingfern-appearance-v1') || 'null');
    if (saved && ['system', 'light', 'dark'].includes(saved.mode)) { mode = saved.mode; cached = true; }
    if (saved && ["basic", "original", "ruby", "coral", "terracotta", "amber", "honey", "olive", "lime", "moss", "sage", "pine", "jade", "mint", "teal", "lagoon", "cyan", "ice", "sky", "ocean", "cobalt", "indigo", "iris", "violet", "lavender", "plum", "orchid", "magenta", "rose", "blush", "cocoa", "sand", "slate"].includes(saved.palette)) palette = saved.palette;
  } catch { /* Storage may be unavailable; the neutral default remains usable. */ }
  if (!cached) {
    document.documentElement.dataset.appearancePending = '';
    const reveal = () => { delete document.documentElement.dataset.appearancePending; };
    window.addEventListener('error', reveal, { once: true });
    window.addEventListener('unhandledrejection', reveal, { once: true });
    setTimeout(reveal, 3000);
  }
  document.documentElement.dataset.theme = mode;
  document.documentElement.dataset.palette = palette;
})();

// Hide the static fallback only while a working script loader can restore it on failure.
(() => {
  const page = document.documentElement;
  page.dataset.notFoundPending = '';
  const reveal = () => { delete page.dataset.notFoundPending; };
  window.addEventListener('error', reveal, { capture: true, once: true });
  window.addEventListener('unhandledrejection', reveal, { once: true });
})();

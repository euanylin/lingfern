let position = 0, restoring = false, restoreTimer: ReturnType<typeof setTimeout> | undefined;

export function initializePageHistory() {
  position = Number.isSafeInteger(history.state?.lingfernPosition) ? history.state.lingfernPosition : 0;
  history.replaceState({ ...history.state, lingfernPosition: position }, '', location.href);
}

export function pushPageHistory(state: object | null, url: string) {
  history.pushState({ ...state, lingfernPosition: ++position }, '', url);
}

export function replacePageHistory(state: object | null, url: string) {
  history.replaceState({ ...state, lingfernPosition: position }, '', url);
}

export function acceptPageHistory(canLeave: () => boolean) {
  const destination = history.state?.lingfernPosition;
  if (!Number.isSafeInteger(destination)) return true;
  clearTimeout(restoreTimer);
  if (restoring && destination === position) { restoring = false; return false; }
  if (!restoring && (destination === position || canLeave())) { position = destination; return true; }
  restoring = true;
  // Restore the existing entry after queued Back/Forward events, without replacing the history stack.
  restoreTimer = setTimeout(() => {
    const current = history.state?.lingfernPosition;
    if (Number.isSafeInteger(current) && current !== position) history.go(position - current);
    else restoring = false;
  }, 0);
  return false;
}

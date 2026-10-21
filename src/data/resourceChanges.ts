export function notifyResourceChange() {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new Event('lingfern-resources-installed'));
  if (typeof BroadcastChannel !== 'undefined') {
    const channel = new BroadcastChannel('lingfern-resources');
    channel.postMessage(null); channel.close();
  }
}

export function PlaybackIcon({ state = 'play' }: { state?: 'play' | 'pause' | 'stop' }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">{state === 'pause' ? <path d="M6 4h4v16H6zm8 0h4v16h-4z"/> : state === 'stop' ? <path d="M5 5h14v14H5z"/> : <path d="M7 3v18l15-9z"/>}</svg>;
}

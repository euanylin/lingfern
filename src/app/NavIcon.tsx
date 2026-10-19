export function NavIcon({ name }: { name: 'today' | 'library' | 'settings' }) {
  const shapes = {
    today: <><rect x="3.5" y="5" width="17" height="16" rx="3"/><path d="M7.5 3v4M16.5 3v4M3.5 10h17"/><circle cx="12" cy="15.5" r="2.5" fill="currentColor" stroke="none"/></>,
    library: <><rect x="3" y="4" width="4.5" height="16" rx="1.2"/><rect x="7.5" y="4" width="5" height="16" rx="1.2"/><path d="m14 5 3.6-.9a1.2 1.2 0 0 1 1.5.9l3.1 12.8a1.2 1.2 0 0 1-.9 1.5l-3.6.9zM4.5 8H6M9 16h2"/></>,
    settings: <><path d="M10 3h4l.6 2.3 1.8 1 2.3-.6 2 3.4-1.7 1.7v2.4l1.7 1.7-2 3.4-2.3-.6-1.8 1L14 21h-4l-.6-2.3-1.8-1-2.3.6-2-3.4L5 13.2v-2.4L3.3 9.1l2-3.4 2.3.6 1.8-1z"/><circle cx="12" cy="12" r="3"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{shapes[name]}</svg>;
}


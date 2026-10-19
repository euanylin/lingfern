import { messages } from '../locales';
import { useEffect, useRef, useState } from 'react';
import type { Locale } from '../shared/content';
import { SharingManagement } from './SharingManagement';

const labels = messages('mcpSettings');
export function McpSettings({ locale, accountId }: { locale: Locale; accountId?: number }) {
  const t = labels[locale], endpoint = 'https://lingfern.com/mcp';
  const [message, setMessage] = useState<'copied' | 'failed'>();
  const address = useRef<HTMLElement>(null);
  useEffect(() => {
    if (message !== 'copied') return;
    const timer = setTimeout(() => setMessage(undefined), 1500);
    return () => clearTimeout(timer);
  }, [message]);
  async function copy() {
    try { await navigator.clipboard.writeText(endpoint); setMessage('copied'); }
    catch {
      if (address.current) { const range = document.createRange(); range.selectNodeContents(address.current); const selection = window.getSelection(); selection?.removeAllRanges(); selection?.addRange(range); }
      setMessage('failed');
    }
  }
  return <section className="mcp-settings" id="mcp"><h2>MCP</h2><p className="muted">{t.description}</p><div className="mcp-endpoint-field"><code className="sharing-endpoint" ref={address} dir="ltr">{endpoint}</code><button className="mcp-copy-button" type="button" aria-label={t.copy} data-copied={message === 'copied'} onClick={() => void copy()}>{message === 'copied' ? <><span aria-hidden="true">✓</span><span role="status">{t.copied}</span></> : <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></svg>}</button></div>{message === 'failed' && <p className="error" role="status">{t.failed}</p>}{accountId !== undefined && <SharingManagement key={accountId} locale={locale} accountId={accountId}/>}</section>;
}

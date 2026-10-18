import { messages } from '../locales';
import { useState } from 'react';
import type { Locale } from '../shared/content';
import { SharingManagement } from './SharingManagement';

const labels = messages('mcpSettings');
export function McpSettings({ locale, accountId }: { locale: Locale; accountId?: number }) {
  const t = labels[locale], endpoint = 'https://lingfern.com/mcp';
  const [message, setMessage] = useState<'copied' | 'failed'>();
  return <section className="mcp-settings" id="mcp"><h2>MCP</h2><p className="muted">{t.description}</p><div className="mcp-endpoint-field"><code className="sharing-endpoint">{endpoint}</code><button className="mcp-copy-button" type="button" aria-label={t.copy} data-copied={message === 'copied'} onClick={() => void (navigator.clipboard?.writeText(endpoint) ?? Promise.reject()).then(() => setMessage('copied')).catch(() => setMessage('failed'))}>{message === 'copied' ? <><span aria-hidden="true">✓</span><span role="status">{t.copied}</span></> : <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/></svg>}</button></div>{message === 'failed' && <p className="error" role="status">{t.failed}</p>}{accountId !== undefined && <SharingManagement key={accountId} locale={locale} accountId={accountId}/>}</section>;
}

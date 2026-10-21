import './validationConfig';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './app/style.css';
import { loadUiLocale } from './locales';
import { initialLocale } from './app/i18n';

try { await loadUiLocale(initialLocale()); } catch { /* Let App.load display loading errors and offer retry. */ }
createRoot(document.getElementById('root')!).render(<App />);

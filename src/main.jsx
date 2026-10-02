import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'

const _fetch = window.fetch.bind(window);
window.fetch = (url, opts = {}) => {
  try {
    const token = localStorage.getItem('btm_token');
    if (token && String(url).includes('/api/')) {
      const headers = new Headers(opts.headers || {});
      if (!headers.has('Authorization')) headers.set('Authorization', 'Bearer ' + token);
      opts = { ...opts, headers };
    }
  } catch (e) {}
  return _fetch(url, opts);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Analytics />
    </BrowserRouter>
  </StrictMode>
)

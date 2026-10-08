import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { BrowserRouter } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'

const _fetch = window.fetch.bind(window);
window.fetch = (url, opts = {}) => {
  const next = { ...opts, credentials: opts.credentials || 'include' };
  return _fetch(url, next);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Analytics />
    </BrowserRouter>
  </StrictMode>
)

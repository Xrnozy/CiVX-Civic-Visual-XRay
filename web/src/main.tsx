import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import './styles/tokens.css';

function Bootstrap() {
  useEffect(() => {
    // #region agent log
    const stylesheets = [...document.styleSheets].map((s) => s.href || 'inline');
    const bodyBg = getComputedStyle(document.body).backgroundColor;
    fetch('http://127.0.0.1:7872/ingest/4dc94be8-1a7a-40d0-91af-b54fa0029a2e', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '8b92e3' },
      body: JSON.stringify({
        sessionId: '8b92e3',
        runId: 'post-fix',
        hypothesisId: 'H1-H2',
        location: 'main.tsx:Bootstrap',
        message: 'React mounted; CSS check',
        data: { stylesheetCount: stylesheets.length, bodyBackground: bodyBg, rootChildCount: document.getElementById('root')?.childElementCount },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, []);

  return (
    <BrowserRouter>
      <App />
    </BrowserRouter>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Bootstrap />
  </StrictMode>,
);

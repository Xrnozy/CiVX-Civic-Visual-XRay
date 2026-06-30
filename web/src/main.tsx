import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useNavigate } from 'react-router-dom';
import App from './App';
import './styles/tokens.css';
import { completeGoogleRedirectIfNeeded } from './lib/auth';

function Bootstrap() {
  const navigate = useNavigate();

  useEffect(() => {
    completeGoogleRedirectIfNeeded().then((result) => {
      if (result) navigate('/');
    });
  }, [navigate]);

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Bootstrap />
    </BrowserRouter>
  </StrictMode>,
);

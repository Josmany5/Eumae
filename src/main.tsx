import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import App from './App';
import { StoreProvider } from './store/store';

// Appearance is applied by the inline script in index.html, before the first
// paint. Reading `eumae:theme` again here would be a second parser of the same
// value, running strictly later than the one that already decided it.

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <StoreProvider>
      <App />
    </StoreProvider>
  </StrictMode>
);

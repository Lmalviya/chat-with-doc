import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initTheme } from './hooks/useTheme.js';
import './styles/global.css';
import App from './App.jsx';

/**
 * Apply the stored/OS theme immediately before React renders,
 * preventing a flash of the wrong theme on page load.
 */
initTheme();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

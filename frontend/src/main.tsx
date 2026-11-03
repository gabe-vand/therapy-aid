import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import '@fontsource-variable/inter';
import App from '@/App';
import '@/styles/index.css';

/* Entry point. The theme is already on <html> (public/theme.js runs before this module); the
   font is self-hosted so it loads under the Pi's font-src 'self' CSP. */
ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
        <BrowserRouter>
            <App />
        </BrowserRouter>
    </React.StrictMode>,
);

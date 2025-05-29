import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ImageProvider } from './context/ImageContext';
import ErrorBoundary from './components/ErrorBoundary';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ImageProvider>
        <App />
      </ImageProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
 
import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
// [NEW] يجب أن يكون هذا أول استيراد — يعترض window.fetch قبل أي طلب API آخر
// ليُلحق بصمة الجهاز (X-Device-Fp) تلقائياً بكل الطلبات (راجع الملف للتفاصيل)
import './utils/fetchFingerprintInterceptor';
import App, { ErrorBoundary } from './App.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then(registration => {
      console.log('SW registered: ', registration);
    }).catch(registrationError => {
      console.log('SW registration failed: ', registrationError);
    });
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
);

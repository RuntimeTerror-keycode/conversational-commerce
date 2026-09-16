import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { isApiConfigured } from '@/api/client';
import { ConfigErrorScreen } from './app/ConfigErrorScreen';
import { Providers } from './app/Providers';
import { router } from './app/router';
import './index.css';

const container = document.getElementById('root');
if (!container) throw new Error('#root missing from index.html');

createRoot(container).render(
  <StrictMode>
    {isApiConfigured ? (
      <Providers>
        <RouterProvider router={router} />
      </Providers>
    ) : (
      <ConfigErrorScreen />
    )}
  </StrictMode>,
);

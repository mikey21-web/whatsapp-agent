'use client';

import { useEffect } from 'react';

export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
    if (process.env.NODE_ENV !== 'production') return;
    const r = navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    return () => {
      void r;
    };
  }, []);
  return null;
}

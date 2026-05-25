import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Providers } from '@/components/providers';
import { ServiceWorkerRegister } from '@/components/sw-register';

export const metadata: Metadata = {
  title: 'diyaa.ai',
  description: 'WhatsApp AI automation for Indian SMBs',
  manifest: '/manifest.webmanifest',
  applicationName: 'diyaa.ai',
  appleWebApp: {
    capable: true,
    title: 'diyaa.ai',
    statusBarStyle: 'default',
  },
};

export const viewport: Viewport = {
  themeColor: '#6366f1',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>
          {children}
          <ServiceWorkerRegister />
        </Providers>
      </body>
    </html>
  );
}

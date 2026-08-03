import type { Metadata, Viewport } from 'next';
import { AuthProvider } from '@/context/auth-context';
import { ServiceWorkerRegister } from '@/components/service-worker-register';
import './globals.css';

export const metadata: Metadata = {
  title: 'BoutikPro — Gestion de commerce',
  description: 'Gérez votre boutique : produits, stock et équipe, sans cahier papier.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'BoutikPro',
  },
};

export const viewport: Viewport = {
  themeColor: '#16a34a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <ServiceWorkerRegister />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

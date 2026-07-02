import '../styles/globals.css';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from '@/lib/theme';
import { I18nProvider } from '@/lib/i18n';
import { DialerProvider } from '@/lib/dialer';
import Providers from '@/lib/providers';
import DialerWidget from '@/components/dialer/DialerWidget';

export const metadata = {
  title: 'Omon CRM — CRM for Travel Agencies',
  description: "Sayohat agentliklari uchun professional CRM",
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="uz" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Omon CRM" />
        <meta name="theme-color" content="#3d7eff" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('theme') || 'dark';
                document.documentElement.setAttribute('data-theme', t);
              } catch {}
              // Service Worker ro'yxatdan o'tkazish
              if ('serviceWorker' in navigator) {
                window.addEventListener('load', function() {
                  navigator.serviceWorker.register('/sw.js').catch(function() {});
                });
              }
            `,
          }}
        />
      </head>
      <body>
        <Providers>
          <ThemeProvider>
            <I18nProvider>
              <DialerProvider>
              {children}
              <DialerWidget />
              <Toaster
                position="top-right"
                toastOptions={{
                  duration: 3000,
                  style: {
                    background: 'var(--bg-2)',
                    color: 'var(--fg)',
                    border: '1px solid var(--border)',
                    fontSize: 13,
                    borderRadius: 10,
                    boxShadow: 'var(--shadow-lg)',
                    padding: '10px 14px',
                  },
                  success: { iconTheme: { primary: 'var(--success)', secondary: 'white' } },
                  error: { iconTheme: { primary: 'var(--danger)', secondary: 'white' } },
                }}
              />
              </DialerProvider>
            </I18nProvider>
          </ThemeProvider>
        </Providers>
      </body>
    </html>
  );
}
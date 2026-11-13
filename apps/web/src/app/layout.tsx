import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import { Providers } from './providers';
import { SiteChrome } from '@/components/layout/SiteChrome';

const geistSans = localFont({
  src: './fonts/Geist-Variable.woff2',
  variable: '--font-geist-sans',
  weight: '100 900',
  display: 'swap',
});

const geistMono = localFont({
  src: './fonts/GeistMono-Variable.woff2',
  variable: '--font-geist-mono',
  weight: '100 900',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'BrewLite',
  description: 'Đặt cà phê nhanh, không cần tiền mặt',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="vi"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      {/* bg-background/text-foreground lấy từ design token trong globals.css */}
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <Providers>
          {/* Header đặt ở layout vì mọi trang (Menu, Cart, Checkout...) đều cần */}
          <SiteChrome>
            {children}
          </SiteChrome>
        </Providers>
      </body>
    </html>
  );
}

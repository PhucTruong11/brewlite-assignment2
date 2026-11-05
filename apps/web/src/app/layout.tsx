import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Providers } from './providers';
import { SiteChrome } from '@/components/layout/SiteChrome';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
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
'use client';

import { usePathname } from 'next/navigation';
import { Header } from './Header';
import { Footer } from './Footer';

// Bọc nội dung: trang /admin thì không hiện Header/Footer của khách
export function SiteChrome({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isAdmin = pathname.startsWith('/admin');

    if (isAdmin) return <>{children}</>;

    return (
        <>
            <Header />
            {children}
            <Footer />
        </>
    );
}
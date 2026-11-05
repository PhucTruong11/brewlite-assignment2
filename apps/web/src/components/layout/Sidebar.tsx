'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCategories } from '@/hooks/useCategories';
import { useCartStore, useHasCartHydrated } from '@/stores/cart.store';

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

const HomeIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
    </svg>
);
const HistoryIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 8v4l3 3M21 12a9 9 0 11-3-6.7M21 3v6h-6" />
    </svg>
);
const GridIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
);
const ChevronIcon = ({ open }: { open: boolean }) => (
    <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        className={`ml-auto transition-transform ${open ? 'rotate-180' : ''}`}
    >
        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);
const SearchIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="7" />
        <path d="M21 21l-4.3-4.3" strokeLinecap="round" />
    </svg>
);

const NAV_ITEMS = [
    { href: '/', label: 'Trang chủ', icon: HomeIcon },
    { href: '/orders', label: 'Lịch sử', icon: HistoryIcon },
];

export function Sidebar({ isOpen, onClose }: SidebarProps) {
    const { user } = useAuth();
    const cartCount = useCartStore((s) => s.totalItems());
    const hasHydrated = useHasCartHydrated();
    const router = useRouter();

    const { categories } = useCategories();

    const [isCategoryOpen, setCategoryOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const q = searchQuery.trim();
        if (!q) return;
        // Giống Header: trả về Home với ?q=..., không còn route /search riêng
        router.push(`/?q=${encodeURIComponent(q)}`);
        onClose();
    };

    return (
        <>
            {isOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/40 lg:hidden"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}

            <aside
                className={`fixed right-0 top-0 z-50 flex h-full w-72 flex-col overflow-y-auto bg-primary text-white transition-transform duration-300 lg:hidden ${isOpen ? 'translate-x-0' : 'translate-x-full'
                    }`}
            >
                <div className="flex items-center justify-end p-4">
                    <button onClick={onClose} aria-label="Đóng menu" className="text-2xl leading-none">
                        ×
                    </button>
                </div>

                <div className="border-b border-white/15 px-4 pb-6">
                    <p className="text-lg font-semibold text-center">
                        Xin chào {user ? user.email : 'Bạn'} !
                    </p>
                    {user && (
                        <p className="mt-0.5 text-sm text-white/80">{user.loyaltyPoints} điểm tích lũy</p>
                    )}

                    {user ? (
                        <button
                            onClick={onClose}
                            className="mt-3 w-full rounded-full border border-white/40 py-2 text-sm font-semibold hover:bg-white/10"
                        >
                            Đăng xuất
                        </button>
                    ) : (
                        <Link
                            href="/auth/login"
                            onClick={onClose}
                            className="mt-3 block rounded-full bg-white py-2.5 text-center text-sm font-semibold text-primary hover:bg-white/90"
                        >
                            Đăng nhập
                        </Link>
                    )}
                </div>

                <div className="p-4">
                    <form onSubmit={handleSearchSubmit} className="relative mb-3">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/60">
                            <SearchIcon />
                        </span>
                        <input
                            type="search"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Tìm món..."
                            className="w-full rounded-full border border-white/20 bg-white/10 py-2 pl-9 pr-3 text-sm text-white placeholder-white/60 outline-none focus:border-white/50"
                        />
                    </form>

                    <nav className="flex flex-col gap-1 text-base font-semibold">
                        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
                            <Link
                                key={href}
                                href={href}
                                onClick={onClose}
                                className="flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-white/10"
                            >
                                <Icon />
                                <span>{label}</span>
                            </Link>
                        ))}

                        <button
                            onClick={() => setCategoryOpen((v) => !v)}
                            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-white/10"
                            aria-expanded={isCategoryOpen}
                        >
                            <GridIcon />
                            <span>Menu</span>
                            <ChevronIcon open={isCategoryOpen} />
                        </button>

                        {isCategoryOpen && (
                            <div className="ml-8 flex flex-col gap-1 border-l border-white/15 pl-3">
                                <Link
                                    href="/?view=all"
                                    onClick={onClose}
                                    className="rounded-lg px-2 py-1.5 text-sm font-bold text-white hover:bg-white/10"
                                >
                                    Tất cả
                                </Link>
                                {categories.map((cat) => (
                                    <Link
                                        key={cat.slug}
                                        href={`/?category=${cat.slug}`}
                                        onClick={onClose}
                                        className="rounded-lg px-2 py-1.5 text-sm font-medium text-white/85 hover:bg-white/10"
                                    >
                                        {cat.label}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </nav>
                </div>

                <div className="mt-auto p-2">
                    <div className="overflow-hidden rounded-xl bg-orange-500 text-primary shadow-lg">
                        <Link
                            href="/cart"
                            onClick={onClose}
                            className="flex items-center justify-center gap-2 px-4 py-3">
                            <p className="text-base font-bold">Giỏ hàng ({hasHydrated ? cartCount : 0})</p>
                        </Link>

                        <Link
                            href="/cart"
                            onClick={onClose}
                            className="mx-2 mb-2 block rounded-lg bg-primary py-2.5 text-center text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
                        >
                            Thanh toán ngay
                        </Link>
                    </div>
                </div>
            </aside>
        </>
    );
}

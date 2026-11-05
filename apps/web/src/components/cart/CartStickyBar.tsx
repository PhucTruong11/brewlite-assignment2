'use client';

import Link from 'next/link';
import { useCartStore, useHasCartHydrated } from '@/stores/cart.store';

export function CartStickyBar() {
    const count = useCartStore((s) => s.totalItems());
    const hasHydrated = useHasCartHydrated();

    if (!hasHydrated || count === 0) return null;

    return (
        <div className="fixed bottom-4 left-0 right-0 z-30 flex justify-center px-4 lg:hidden">
            <Link
                href="/cart"
                className="flex w-fit items-center gap-2 rounded-full bg-orange-500 px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-primary-hover"
            >
                <span>Xem giỏ hàng ({count})</span>
            </Link>
        </div>
    );
}
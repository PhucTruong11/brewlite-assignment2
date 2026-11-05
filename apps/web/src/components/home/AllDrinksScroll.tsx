'use client';

import { useSyncExternalStore } from 'react';
import { useSearchParams } from 'next/navigation';
import { useProducts } from '@/hooks/useProducts';
import { useCategories } from '@/hooks/useCategories';
import { ProductCard } from '@/components/product/ProductCard';

function subscribe() {
    return () => { };
}

export function AllDrinksScroll() {
    const searchParams = useSearchParams();
    const categorySlug = searchParams.get('category');
    const searchQuery = searchParams.get('q');

    const { categories } = useCategories();

    const { data: filteredProducts, isLoading, isError } = useProducts({
        category: categorySlug ?? undefined,
        search: searchQuery ?? undefined,
    });

    const hasMounted = useSyncExternalStore(
        subscribe,
        () => true,
        () => false,
    );

    const showLoading = !hasMounted || isLoading;

    const activeLabel = categories.find((c) => c.slug === categorySlug)?.label;
    const heading = searchQuery
        ? `Kết quả cho "${searchQuery}"`
        : activeLabel ?? 'Tất cả đồ uống';

    return (
        <section className="mt-6">
            <h2 className="mb-4 text-lg font-bold text-text">{heading}</h2>

            {showLoading && (
                <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-64 animate-pulse rounded-2xl bg-surface" />
                    ))}
                </div>
            )}

            {!showLoading && isError && (
                <p className="rounded-xl bg-surface p-4 text-sm text-text/70">
                    Không tải được danh sách đồ uống. Vui lòng thử lại sau.
                </p>
            )}

            {!showLoading && filteredProducts && filteredProducts.length === 0 && (
                <p className="rounded-xl bg-surface p-4 text-sm text-text/70">
                    {searchQuery
                        ? `Không tìm thấy món nào khớp với "${searchQuery}".`
                        : `Hiện chưa có sản phẩm nào${activeLabel ? ` trong mục "${activeLabel}"` : ''}.`}
                </p>
            )}

            {!showLoading && filteredProducts && filteredProducts.length > 0 && (
                <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
                    {filteredProducts.map((product) => (
                        <ProductCard key={product.id} product={product} variant="bestseller" />
                    ))}
                </div>
            )}
        </section>
    );
}
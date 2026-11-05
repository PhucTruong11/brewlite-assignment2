'use client';

import { useBestSellers } from '@/hooks/useBestSellers';
import { ProductCard } from '@/components/product/ProductCard';

export function BestSellers() {
    const { data: products, isLoading, isError } = useBestSellers();

    return (
        <section>
            <h2 className="mb-3 text-lg font-bold text-text">Món Bán Chạy</h2>

            {isLoading && (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-36 animate-pulse rounded-xl bg-surface" />
                    ))}
                </div>
            )}

            {isError && (
                <p className="rounded-xl bg-surface p-4 text-sm text-text/70">
                    Không tải được danh sách món bán chạy. Vui lòng thử lại sau.
                </p>
            )}

            {products && products.length === 0 && (
                <p className="rounded-xl bg-surface p-4 text-sm text-text/70">
                    Chưa có món nào nổi bật lúc này.
                </p>
            )}

            {products && products.length > 0 && (
                <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
                    {products.map((product, index) => (
                        <ProductCard
                            key={product.id}
                            product={product}
                            variant="bestseller"
                            priority={index < 4} // 4 ảnh đầu nằm ở màn hình đầu nên tải ưu tiên
                        />
                    ))}
                </div>
            )}
        </section>
    );
}
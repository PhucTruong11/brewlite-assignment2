import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { parseSearchQuery, matchesProduct } from '@/lib/search';
import type { ApiResponse, Product } from '@/types';

interface UseProductsParams {
    category?: string;
    search?: string;
}

interface RawProduct extends Omit<Product, 'price'> {
    prices?: { size: string; price: number }[];
}

function getBasePrice(p: RawProduct): number {
    if (!p.prices?.length) return 0;
    // Ưu tiên size S; nếu không có thì lấy giá thấp nhất (thường ~ base)
    const sizeS = p.prices.find((x) => x.size === 'S');
    if (sizeS) return Number(sizeS.price);
    return Math.min(...p.prices.map((x) => Number(x.price)));
}

function normalizeProduct(p: RawProduct): Product {
    return {
        ...p,
        price: getBasePrice(p),
    } as Product;
}

export function useProducts(params: UseProductsParams = {}) {
    const { search, ...apiParams } = params;

    return useQuery({
        queryKey: ['products', params],
        queryFn: async () => {
            const res = await api.get<ApiResponse<RawProduct[]>>('/products', {
                params: apiParams,
            });
            const all = res.data.data.map(normalizeProduct);

            if (!search?.trim()) return all;

            const parsed = parseSearchQuery(search);
            return all.filter((p) => matchesProduct(p, parsed));
        },
    });
}
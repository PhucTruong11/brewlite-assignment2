import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import type { ApiResponse, Product } from '@/types';

const MAX_BEST_SELLERS = 4; // khớp layout 2x2 trong thiết kế

export function useBestSellers() {
    return useQuery({
        queryKey: ['products', 'best-sellers'],
        queryFn: async () => {
            const res = await api.get<ApiResponse<Product[]>>('/products/best-sellers', {
                params: { limit: MAX_BEST_SELLERS },
            });
            return res.data.data;
        },
        staleTime: 5 * 60 * 1000, 
    });
}
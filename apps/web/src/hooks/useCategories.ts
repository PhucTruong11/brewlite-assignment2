import { useMemo } from 'react';
import { useProducts } from './useProducts';

export interface CategoryOption {
    slug: string;
    label: string;
}

const CATEGORY_LABELS: Record<string, string> = {
    phin: 'Cà phê Phin',
    phindi: 'PhinDi',
    espresso: 'Cà phê Espresso',
    tra: 'Trà',
    freeze: 'Đá xay (Freeze)',
    other: 'Khác',
};

function toLabel(slug: string): string {
    return CATEGORY_LABELS[slug] ?? slug.charAt(0).toUpperCase() + slug.slice(1);
}

export function useCategories() {
    const { data: products, isLoading, isError } = useProducts();

    const categories = useMemo<CategoryOption[]>(() => {
        if (!products) return [];
        const uniqueSlugs = Array.from(
            new Set(products.map((p) => p.category).filter((c): c is string => !!c)),
        );
        return uniqueSlugs
            .map((slug) => ({ slug, label: toLabel(slug) }))
            .sort((a, b) => {
                if (a.slug === 'other') return 1; // other luôn xuống cuối
                if (b.slug === 'other') return -1;
                return a.label.localeCompare(b.label, 'vi'); // A-Z theo tiếng Việt
            });
    }, [products]);

    return { categories, isLoading, isError };
}
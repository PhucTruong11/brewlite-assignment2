'use client';

import { useSearchParams } from 'next/navigation';
import { PromoCarousel } from './PromoCarousel';
import { BestSellers } from './BestSellers';
import { AllDrinksScroll } from './AllDrinksScroll';

export function HomeSections() {
    const searchParams = useSearchParams();
    const isFiltering =
        !!searchParams.get('category') || !!searchParams.get('q') || searchParams.get('view') === 'all';

    return (
        <>
            {!isFiltering && (
                <>
                    <PromoCarousel />
                    <BestSellers />
                </>
            )}
            <AllDrinksScroll />
        </>
    );
}
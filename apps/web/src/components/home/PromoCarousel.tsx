'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';

interface Slide {
    desktopUrl: string; // ảnh 3:1, 1920x640 cho laptop
    mobileUrl: string;  // ảnh 3:2, 1200x800 cho mobile
    alt: string;
}

const SLIDES: Slide[] = [
    { desktopUrl: '/images/banner_gioi_thieu.jpg', mobileUrl: '/images/banner_gioi_thieu_mobile.jpg', alt: 'Gioi thieu' },
    { desktopUrl: '/images/banner_san_pham.jpg', mobileUrl: '/images/banner_san_pham_mobile.jpg', alt: 'San pham' },
    { desktopUrl: '/images/banner_khuyen_mai.jpg', mobileUrl: '/images/banner_khuyen_mai_mobile.jpg', alt: 'Khuyen mai' },
    { desktopUrl: '/images/banner_cham_soc.jpg', mobileUrl: '/images/banner_cham_soc_mobile.jpg', alt: 'Cham soc' },
];

const AUTO_SLIDE_INTERVAL_MS = 4000;

export function PromoCarousel() {
    const [activeIndex, setActiveIndex] = useState(0);

    useEffect(() => {
        if (SLIDES.length <= 1) return;
        const timer = setInterval(() => {
            setActiveIndex((i) => (i + 1) % SLIDES.length);
        }, AUTO_SLIDE_INTERVAL_MS);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="relative overflow-hidden rounded-2xl">
            <div
                className="flex transition-transform duration-700 ease-in-out"
                style={{ transform: `translateX(-${activeIndex * 100}%)` }}
            >
                {SLIDES.map((slide, i) => (
                    <div
                        key={i}
                        className="relative h-[35svh] min-h-[180px] max-h-[320px] w-full shrink-0 bg-primary md:h-auto md:max-h-none md:min-h-0 md:aspect-[3/1]"
                    >
                        <Image
                            src={slide.mobileUrl}
                            alt={slide.alt}
                            fill
                            priority={i === 0}
                            sizes="100vw"
                            className="object-fill md:hidden"
                        />
                        <Image
                            src={slide.desktopUrl}
                            alt={slide.alt}
                            fill
                            priority={i === 0}
                            sizes="(max-width: 1024px) 100vw, 960px"
                            className="hidden object-cover md:block"
                        />
                    </div>
                ))}
            </div>

            {SLIDES.length > 1 && (
                <div className="absolute inset-x-0 bottom-3 flex justify-center gap-1.5">
                    {SLIDES.map((_, i) => (
                        <button
                            key={i}
                            onClick={() => setActiveIndex(i)}
                            aria-label={`Xem banner ${i + 1}`}
                            className={`h-1.5 rounded-full transition-all ${i === activeIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/50'
                                }`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
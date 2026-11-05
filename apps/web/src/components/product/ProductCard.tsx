'use client';

import Link from 'next/link';
import Image from 'next/image';
import { formatVND } from '@/lib/utils';
import type { Product } from '@/types';
import React, { useEffect, useState } from 'react';
import { useCartStore, type CartItem } from '@/stores/cart.store';
import { cartValidationMessage, validateCart } from '@/lib/validate-cart';

interface ProductCardProps {
    product: Product & {
        prices?: { size: string; price: number }[];
        price?: number;
        isBestSeller?: boolean;
        stockBySize?: Record<string, number>;
    };
    variant?: 'bestseller' | 'compact';
    priority?: boolean; // Thuộc tính ưu tiên tải ảnh nhanh nếu nằm ở màn hình đầu
}

function getDisplayPrice(product: ProductCardProps['product']): { rawPrice: number; formattedPrice: string } {
    let rawPrice: number | undefined;

    if (product.price !== undefined && product.price !== null) {
        rawPrice = Number(product.price);
    } else if (product.prices && product.prices.length > 0) {
        rawPrice = Number(product.prices[0].price);
    }

    if (rawPrice === undefined || isNaN(rawPrice)) {
        return { rawPrice: 0, formattedPrice: '0đ' };
    }

    const formattedPrice = formatVND ? formatVND(rawPrice) : `${rawPrice.toLocaleString('vi-VN')}đ`;
    return { rawPrice, formattedPrice };
}
    const CartPlusIcon = () => (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="9" cy="20" r="1" />
            <circle cx="18" cy="20" r="1" />
            <path d="M2 3h3l2.7 12.4a1 1 0 001 .8h9.7a1 1 0 001-.8L21 7H6" />
            <path d="M13.5 8.5v5M11 11h5" />
        </svg>
    );
export function ProductCard({ product, variant = 'bestseller', priority = false }: ProductCardProps) {
    const href = `/product/${product.id}`;
    const { rawPrice, formattedPrice } = getDisplayPrice(product);
    const addItemToCart = useCartStore((s) => s.addItem);
    const [showAddedToast, setShowAddedToast] = useState(false);
    const [adding, setAdding] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);

    useEffect(() => {
        if (!showAddedToast) return;
        const timer = setTimeout(() => setShowAddedToast(false), 2000);
        return () => clearTimeout(timer);
    }, [showAddedToast]);

    const isOutOfStock = (product.stock !== undefined && product.stock <= 0) || product.isAvailable === false;

    const handleQuickAdd = async () => {
        if (isOutOfStock) return;

        const defaultSize = (product.prices && product.prices.length > 0 ? product.prices[0].size : 'S') as 'S' | 'M' | 'L';
        if ((product.stockBySize?.[defaultSize] ?? product.stock ?? 0) <= 0) {
            setAddError(`Size ${defaultSize} đang thiếu nguyên liệu`);
            return;
        }
        const validPrice = Number(rawPrice) || 0;

        const newItem: CartItem = {
            productId: product.id,
            name: product.name,
            size: defaultSize,
            basePrice: validPrice,
            toppings: [],
            totalToppingPrice: 0,
            unitPrice: validPrice,
            quantity: 1,
            lineTotal: validPrice,
            imageUrl: product.imageUrl ?? undefined,
        };

        setAdding(true);
        setAddError(null);
        try {
            const validation = await validateCart([...useCartStore.getState().items, newItem]);
            if (!validation.available) {
                setAddError(cartValidationMessage(validation));
                return;
            }
            addItemToCart(newItem);
            setShowAddedToast(true);
        } catch {
            setAddError('Không kiểm tra được nguyên liệu. Vui lòng thử lại.');
        } finally {
            setAdding(false);
        }
    };
    

    if (variant === 'compact') {
        return (
            <Link
                href={href}
                className="group flex w-full flex-col items-center gap-2 text-center transition-all duration-300 ease-in-out hover:-translate-y-1"
            >
                <div className="relative h-20 w-20 overflow-hidden rounded-2xl bg-surface shadow-sm transition-all duration-300 group-hover:scale-105 group-hover:shadow-md">
                    {product.imageUrl ? (
                        <Image
                            src={product.imageUrl}
                            alt={product.name}
                            fill
                            sizes="80px"
                            priority={priority}
                            className={`object-cover transition-opacity duration-300 ${isOutOfStock ? 'opacity-40 grayscale' : ''}`}
                        />
                    ) : (
                        <div className="flex h-full w-full items-center justify-center text-2xl">☕</div>
                    )}
                    {isOutOfStock && (
                        <span className="absolute inset-0 flex items-center justify-center bg-black/60 text-[10px] font-bold uppercase tracking-wider text-white">
                            Hết
                        </span>
                    )}
                </div>
                <div>
                    <p className="line-clamp-1 text-sm font-medium leading-tight text-text transition-colors group-hover:text-primary">
                        {product.name}
                    </p>
                    <p className="mt-0.5 text-xs text-text/70">{formattedPrice}</p>
                </div>
            </Link>
        );
    }

    return (
        <div className="group relative flex flex-col items-center justify-between gap-3 rounded-2xl border border-primary/15 bg-surface p-4 text-center shadow-sm transition-all duration-300 ease-in-out hover:-translate-y-1.5 hover:border-primary/40 hover:shadow-xl">
            {isOutOfStock ? (
                <span className="pointer-events-none absolute -right-1.5 -top-1.5 z-10 rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md">
                    HẾT HÀNG
                </span>
            ) : product.isBestSeller ? (
                <span className="pointer-events-none absolute -right-1.5 -top-1.5 z-10 rounded-full bg-orange-500 px-2.5 py-0.5 text-[10px] font-bold text-white shadow-md">
                    HOT!
                </span>
            ) : null}

            {showAddedToast && (
                <span className="pointer-events-none absolute left-1/2 top-3 z-20 -translate-x-1/2 whitespace-nowrap rounded-full bg-green-600 px-4 py-2 text-sm font-bold text-white shadow-lg animate-in fade-in zoom-in-95 duration-300">
                    ✓ Đã thêm vào giỏ hàng
                </span>
            )}
            {addError && <p role="alert" className="relative z-10 text-xs text-red-600">{addError}</p>}

            {/* Khung ảnh cố định dùng thành phần hiển thị ảnh của Next.js. */}
            <div className="relative h-28 w-28 overflow-hidden rounded-full bg-background shadow-inner transition-transform duration-300 ease-in-out group-hover:scale-105">
                {product.imageUrl ? (
                    <Image
                        src={product.imageUrl}
                        alt={product.name}
                        fill
                        sizes="112px"
                        priority={priority}
                        loading={priority ? 'eager' : undefined}
                        className={`object-cover transition-opacity duration-300 ${isOutOfStock ? 'opacity-40 grayscale' : ''}`}
                    />
                ) : (
                    <div className="flex h-full w-full items-center justify-center text-3xl">☕</div>
                )}

                {isOutOfStock && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
                        <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white">
                            Hết hàng
                        </span>
                    </div>
                )}
            </div>

            <div className="flex w-full flex-col items-center gap-1">
                {/* Liên kết phủ kín thẻ món; khung ngoài không đặt vị trí tương đối. */}
                <Link
                    href={href}
                    className="line-clamp-1 text-base font-semibold text-text transition-colors group-hover:text-primary after:absolute after:inset-0 after:content-['']"
                >
                    {product.name}
                </Link>
                <p className="text-sm font-bold text-primary">{formattedPrice}</p>
            </div>

            <div className="relative z-10 flex w-full overflow-hidden rounded-full shadow-sm">
                <button
                    type="button"
                    onClick={handleQuickAdd}
                    disabled={isOutOfStock || adding}
                    aria-label="Thêm vào giỏ hàng"
                    title={isOutOfStock ? 'Hết hàng' : 'Thêm vào giỏ hàng'}
                    className={`flex w-2/5 shrink-0 items-center justify-center bg-primary py-2 text-white transition-colors duration-500 ${
                        isOutOfStock
                            ? 'cursor-not-allowed opacity-50'
                            : 'hover:bg-primary/10 hover:text-primary active:scale-95'
                    }`}
                >
                    <CartPlusIcon />
                </button>

                <Link
                    href={href}
                    className="flex flex-1 items-center justify-center border-l border-white/30 bg-primary py-2 text-sm font-medium text-white transition-colors duration-500 hover:bg-primary/10 hover:text-primary"
                >
                    Chi tiết
                </Link>
            </div>
        </div>
    );
}

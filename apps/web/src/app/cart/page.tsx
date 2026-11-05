'use client';

import { CartContent } from '@/components/cart/CartContent';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function CartPage() {
  return (
    <div className="min-h-screen flex flex-col bg-surface md:bg-background">
      {/* Header cho trang Giỏ hàng Mobile */}
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100 px-4 h-14 flex items-center md:hidden shadow-sm">
        <Link href="/" className="p-2 -ml-2 text-text hover:bg-gray-100 rounded-full transition-colors">
          <ArrowLeft size={24} />
        </Link>
        <h1 className="font-bold text-lg text-text ml-2">Giỏ hàng của bạn</h1>
      </header>

      {/* 
        Trên Mobile: Ẩn padding, tràn viền
        Trên Laptop: Ép vào một khối ở giữa màn hình cho đẹp 
      */}
      <main className="flex-1 md:py-12 md:px-4">
        <div className="h-full md:h-auto w-full flex justify-center md:min-h-[600px]">
          <CartContent />
        </div>
      </main>
    </div>
  );
}

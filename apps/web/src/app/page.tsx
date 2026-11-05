import { Suspense } from 'react';
import { HomeSections } from '@/components/home/HomeSections';
import { CartStickyBar } from '@/components/cart/CartStickyBar';

export const dynamic = 'force-dynamic';

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-4 pb-24 lg:pb-8 lg:px-8">
      <Suspense fallback={<div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-2xl bg-surface" />
        ))}
      </div>}>
        <HomeSections />
      </Suspense>

      {/* Fixed ở đáy màn hình, tự ẩn khi giỏ hàng trống */}
      <CartStickyBar />
    </main>
  );
}
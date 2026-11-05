'use client';

import React from 'react';
import Link from 'next/link';

export function EmptyCheckout() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <div className="rounded-full bg-emerald-50 p-6 text-primary mb-4 text-4xl">
        ☕
      </div>
      <h2 className="text-xl font-bold text-[#1E3932] mb-2">
        Chưa có món nào để thanh toán
      </h2>
      <p className="text-sm text-gray-500 mb-6">
        Giỏ hàng của bạn đang trống. Vui lòng chọn những thức uống tuyệt ngon từ menu trước khi tiến hành thanh toán nhé!
      </p>
      <Link
        href="/"
        className="rounded-full bg-primary hover:bg-primary-hover px-6 py-3 font-bold text-white transition-all shadow-md active:scale-95"
      >
        Khám phá thực đơn
      </Link>
    </main>
  );
}

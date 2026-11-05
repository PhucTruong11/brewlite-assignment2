'use client';

import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/api';
import { formatVND } from '@/lib/utils';
import type { OrderStatus } from '@/types';

interface Summary {
    counts: Record<OrderStatus, number>;
    todayOrders: number;
    todayRevenue: number;
}

export default function AdminHomePage() {
    const { data, isLoading } = useQuery({
        queryKey: ['admin-counts'], // dùng chung key với trang Đơn hàng
        queryFn: async () => (await api.get<{ data: Summary }>('/admin/orders/counts')).data.data,
        refetchInterval: 2_000,
    });

    const count = (s: OrderStatus) => data?.counts[s] ?? 0;
    const todayOrders = data?.todayOrders ?? 0;
    const todayRevenue = data?.todayRevenue ?? 0;

    // Doanh thu & số đơn của hôm nay

    const cards = [
        { label: 'Chờ pha chế', value: count('PAID'), color: 'text-blue-700 bg-blue-50' },
        { label: 'Đang pha chế', value: count('PREPARING'), color: 'text-purple-700 bg-purple-50' },
        { label: 'Sẵn sàng giao', value: count('READY'), color: 'text-green-700 bg-green-50' },
        { label: 'Hoàn tất', value: count('COMPLETED'), color: 'text-gray-700 bg-gray-100' },
    ];

    return (
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 lg:px-8">
            <h1 className="text-2xl font-extrabold tracking-tight text-text">Tổng quan</h1>
            <p className="mt-1 text-sm text-text/70">Tình hình đơn hàng (tự cập nhật mỗi 2 giây)</p>

            {/* Doanh thu hôm nay */}
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-primary/15 bg-surface p-5 shadow-sm">
                    <p className="text-xs font-semibold text-text/60">Doanh thu hôm nay</p>
                    <p className="mt-1 text-2xl font-black text-primary">
                        {isLoading ? '...' : formatVND(todayRevenue)}
                    </p>
                </div>
                <div className="rounded-2xl border border-primary/15 bg-surface p-5 shadow-sm">
                    <p className="text-xs font-semibold text-text/60">Đơn hôm nay</p>
                    <p className="mt-1 text-2xl font-black text-primary">
                        {isLoading ? '...' : todayOrders}
                    </p>
                </div>
            </div>

            {/* Số đơn theo trạng thái */}
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
                {cards.map((c) => (
                    <div key={c.label} className="rounded-2xl border border-primary/15 bg-surface p-4 shadow-sm">
                        <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${c.color}`}>
                            {c.label}
                        </span>
                        <p className="mt-3 text-3xl font-black text-text">{isLoading ? '...' : c.value}</p>
                    </div>
                ))}
            </div>

            <Link
                href="/admin/orders"
                className="mt-6 inline-block rounded-full bg-primary px-6 py-2.5 text-sm font-bold text-white shadow-md hover:bg-primary-hover"
            >
                Xử lý đơn hàng →
            </Link>
        </main>
    );
}

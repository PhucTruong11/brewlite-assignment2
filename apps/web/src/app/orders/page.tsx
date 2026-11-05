'use client';

import { useQuery } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { RequireAuth } from '@/components/auth/RequireAuth';
import { CartStickyBar } from '@/components/cart/CartStickyBar';
import {
  OrderStatusBadge,
  OrderStatusStepper,
} from '@/components/orders/OrderStatus';
import { formatVND } from '@/lib/utils';
import type { Order } from '@/types';
import { useAuth } from '@/hooks/useAuth';

const ACTIVE_STATUSES: Order['status'][] = ['PENDING', 'PAID', 'PREPARING', 'READY'];
const PAST_STATUSES: Order['status'][] = [
  'COMPLETED',
  'CANCELLED',
  'PAYMENT_FAILED',
];

function formatVietnameseDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function getOrderCode(order: Order): string {
  return order.id.slice(0, 8).toUpperCase();
}

function getItemCount(order: Order): number {
  return order.items.reduce((sum, item) => sum + item.qty, 0);
}

function OrderHistoryContent() {
  const router = useRouter();
  const { user } = useAuth();
  const { data: orders, isPending: loading, error: requestError, refetch } = useQuery({
    queryKey: ['orders', user?.id, 'me'],
    enabled: !!user,
    queryFn: async ({ signal }) => {
      const res = await api.get<{ data: Order[] }>('/orders/me', { signal });
      return Array.isArray(res.data.data) ? res.data.data : [];
    },
    refetchInterval: (query) => {
      const error = query.state.error;
      return isAxiosError(error) && error.response && error.response.status < 500 ? false : 2000;
    },
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
    retry: (count, error) => count < 2 && (!isAxiosError(error) || !error.response || error.response.status >= 500),
  });
  const statusCode = isAxiosError(requestError) ? requestError.response?.status : undefined;
  const error = statusCode === 401 || statusCode === 403
    ? 'Bạn cần đăng nhập để xem lịch sử đơn hàng.'
    : 'Không thể tải lịch sử đơn hàng.';

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-gray-500">Đang tải lịch sử đơn hàng...</p>
      </div>
    );
  }

  if (!orders || statusCode === 401 || statusCode === 403) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-2 px-4 text-center">
        <p className="text-sm font-semibold text-rose-600">
          {error}
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white"
        >
          Thử lại
        </button>
      </div>
    );
  }

  const activeOrders = orders.filter((order) => ACTIVE_STATUSES.includes(order.status));
  const pastOrders = orders.filter((order) => PAST_STATUSES.includes(order.status));

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 pb-24 lg:px-8 lg:pb-8">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight text-text">Đơn hàng của tôi</h1>
        <p className="mt-1 text-sm text-text/70">Theo dõi trạng thái và lịch sử các món đã đặt</p>
      </div>

      {activeOrders.length > 0 && (
        <section className="flex flex-col gap-3">
          <h2 className="text-base font-bold text-text">Đơn hàng đang xử lý</h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {activeOrders.map((order) => (
              <div key={order.id} className="rounded-2xl border border-primary/20 bg-surface p-5 shadow-sm">
                <div className="flex flex-col gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-black text-text">#{getOrderCode(order)}</p>
                      <p className="text-xs text-text/60">
                        {formatVietnameseDateTime(order.createdAt)}
                      </p>
                    </div>
                    <OrderStatusBadge status={order.status} />
                  </div>
                  <OrderStatusStepper status={order.status} />
                  <div className="flex items-center justify-between border-t border-primary/10 pt-3">
                    <span className="text-sm font-medium text-text/70">
                      {getItemCount(order)} món
                    </span>
                    <span className="text-lg font-black text-primary">
                      {formatVND(order.total)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => router.push(`/orders/${order.id}`)}
                    className="w-full rounded-full bg-primary py-2.5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-primary-hover active:scale-[0.99]"
                  >
                    Xem chi tiết đơn hàng →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-bold text-text">Lịch sử đơn hàng</h2>
        <div className="overflow-hidden rounded-2xl border border-primary/15 bg-surface shadow-sm">
          {pastOrders.length === 0 ? (
            <div className="flex min-h-36 items-center justify-center px-4 text-center">
              <p className="text-sm font-medium text-text/60">Chưa có đơn hàng nào trong lịch sử.</p>
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
              <table className="w-full min-w-[680px] text-left text-sm text-text">
                <thead className="sticky top-0 z-10 border-b border-primary/10 bg-[#FAF7F0] text-xs font-bold uppercase tracking-wider text-text/75">
                  <tr>
                    <th className="px-5 py-3.5">Mã đơn</th>
                    <th className="px-4 py-3.5">Thời gian</th>
                    <th className="px-4 py-3.5 text-center">Số món</th>
                    <th className="px-4 py-3.5 text-center">Trạng thái</th>
                    <th className="px-4 py-3.5">Tổng tiền</th>
                    <th className="px-5 py-3.5 text-right">Hành động</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary/10">
                  {pastOrders.map((order) => (
                    <tr key={order.id} className="transition-colors hover:bg-primary/[0.03]">
                      <td className="whitespace-nowrap px-5 py-3.5 font-bold text-text">
                        #{getOrderCode(order)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 text-xs text-text/70">
                        {formatVietnameseDateTime(order.createdAt)}
                      </td>
                      <td className="px-4 py-3.5 text-center font-medium text-text/80">
                        {getItemCount(order)}
                      </td>
                      <td className="px-4 py-3.5 text-center">
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3.5 font-bold text-primary">
                        {formatVND(order.total)}
                      </td>
                      <td className="whitespace-nowrap px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => router.push(`/orders/${order.id}`)}
                          className="rounded-full border border-primary/20 bg-surface px-3.5 py-1.5 text-xs font-bold text-primary transition-all hover:bg-primary hover:text-white"
                        >
                          Xem chi tiết
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      <CartStickyBar />
    </main>
  );
}

export default function OrderHistoryPage() {
  return (
    <RequireAuth>
      <OrderHistoryContent />
    </RequireAuth>
  );
}

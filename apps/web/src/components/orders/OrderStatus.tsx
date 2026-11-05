import type { OrderStatus } from '@/types';

const STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: 'Chờ thanh toán',
  PAID: 'Đã thanh toán',
  PREPARING: 'Đang chuẩn bị',
  READY: 'Có thể nhận',
  COMPLETED: 'Hoàn tất',
  CANCELLED: 'Đã hủy',
  PAYMENT_FAILED: 'Thanh toán thất bại',
};

const STATUS_BADGE_CLASS: Record<OrderStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-800 border border-amber-200/60',
  PAID: 'bg-blue-100 text-blue-800 border border-blue-200/60',
  PREPARING: 'bg-purple-100 text-purple-800 border border-purple-200/60',
  READY: 'bg-emerald-100 text-emerald-800 border border-emerald-200/60',
  COMPLETED: 'bg-gray-100 text-gray-700 border border-gray-200/70',
  CANCELLED: 'bg-rose-100 text-rose-700 border border-rose-200/60',
  PAYMENT_FAILED: 'bg-rose-100 text-rose-700 border border-rose-200/60',
};

const STEPS: { status: OrderStatus; label: string }[] = [
  { status: 'PENDING', label: 'Đặt đơn' },
  { status: 'PAID', label: 'Đã thanh toán' },
  { status: 'PREPARING', label: 'Đang chuẩn bị' },
  { status: 'READY', label: 'Có thể nhận' },
];

const cn = (...classes: (string | boolean | undefined)[]) =>
  classes.filter(Boolean).join(' ');

function getStepIndex(status: OrderStatus): number {
  if (status === 'COMPLETED') return STEPS.length - 1;
  return STEPS.findIndex((step) => step.status === status);
}

export function OrderStatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${STATUS_BADGE_CLASS[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function OrderStatusStepper({ status }: { status: OrderStatus }) {
  if (status === 'CANCELLED' || status === 'PAYMENT_FAILED') {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
        {status === 'CANCELLED' ? 'Đơn hàng đã bị hủy' : 'Thanh toán thất bại'}
      </div>
    );
  }

  const currentIndex = getStepIndex(status);

  return (
    <div className="flex items-center justify-between">
      {STEPS.map((step, index) => {
        const isCompleted = index <= currentIndex;
        const isLast = index === STEPS.length - 1;

        return (
          <div key={step.status} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  'flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold transition-all',
                  isCompleted
                    ? 'bg-primary text-white shadow-sm'
                    : 'bg-primary/10 text-text/50',
                )}
              >
                {index + 1}
              </div>
              <span
                className={cn(
                  'whitespace-nowrap text-[11px] font-semibold',
                  isCompleted
                    ? 'text-text'
                    : 'text-text/40',
                )}
              >
                {step.label}
              </span>
            </div>
            {!isLast && (
              <div
                className={cn(
                  'mx-2 h-0.5 flex-1 rounded-full',
                  index < currentIndex
                    ? 'bg-primary'
                    : 'bg-primary/15',
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

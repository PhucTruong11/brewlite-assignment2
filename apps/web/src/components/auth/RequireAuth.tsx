'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { isAuthenticated, loading, error, refetchUser } = useAuth();

  useEffect(() => {
    if (!loading && !error && !isAuthenticated) {
      const redirect = window.location.pathname + window.location.search;
      router.replace(`/auth/login?redirect=${encodeURIComponent(redirect)}`);
    }
  }, [isAuthenticated, loading, error, router]);

  if (!loading && error && !isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
        <p className="text-sm text-red-600">{error}</p>
        <button type="button" onClick={() => void refetchUser()} className="rounded-lg bg-primary px-4 py-2 font-semibold text-white">
          Thử lại
        </button>
      </div>
    );
  }

  if (loading || !isAuthenticated) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm text-text/60">
        Đang kiểm tra đăng nhập...
      </div>
    );
  }

  return children;
}

'use client';

import { createContext, useCallback, useEffect, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useCartStore } from '@/stores/cart.store';

export interface User {
  id: string;
  email: string;
  role: string;
  name?: string;
  fullName?: string | null;
  phone?: string | null;
  loyaltyPoints?: number;
}

interface AuthState {
  user: User | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
  refetchUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const SESSION_KEY = ['auth', 'session'] as const;
export const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const initUserCart = useCartStore((state) => state.initUserCart);
  const [logoutError, setLogoutError] = useState<string | null>(null);
  const { data, isPending, error, refetch } = useQuery({
    queryKey: SESSION_KEY,
    queryFn: async ({ signal }): Promise<User | null> => {
      try {
        const response = await api.get<User | { data: User }>('/auth/me', { signal, timeout: 10000 });
        const user = 'data' in response.data ? response.data.data : response.data;
        if (!user || !user.id || typeof user.email !== 'string' || typeof user.role !== 'string') {
          throw new Error('Thông tin phiên đăng nhập không hợp lệ');
        }
        return user;
      } catch (requestError) {
        if (isAxiosError(requestError) && requestError.response?.status === 401) return null;
        throw requestError;
      }
    },
    retry: (count, requestError) => count < 2 && (!isAxiosError(requestError) || !requestError.response || requestError.response.status >= 500),
    refetchOnWindowFocus: 'always',
    refetchOnReconnect: 'always',
  });

  const user = data ?? null;
  const userId = user?.id ?? null;
  const sessionResolved = data !== undefined;

  useEffect(() => {
    if (sessionResolved) initUserCart(userId);
  }, [sessionResolved, userId, initUserCart]);

  useEffect(() => {
    const expireSession = () => {
      void queryClient.cancelQueries({ queryKey: SESSION_KEY });
      queryClient.setQueryData(SESSION_KEY, null);
    };
    window.addEventListener('unauthorized', expireSession);
    return () => window.removeEventListener('unauthorized', expireSession);
  }, [queryClient]);

  const refetchUser = useCallback(async () => {
    setLogoutError(null);
    await refetch();
  }, [refetch]);

  const logout = useCallback(async () => {
    setLogoutError(null);
    try {
      await api.post('/auth/logout');
    } catch (requestError) {
      if (!isAxiosError(requestError) || requestError.response?.status !== 401) {
        setLogoutError('Không thể đăng xuất. Vui lòng thử lại.');
        return;
      }
    }
    await queryClient.cancelQueries();
    queryClient.removeQueries({
      predicate: (query) => query.queryKey[0] === 'orders' || String(query.queryKey[0]).startsWith('admin-'),
    });
    queryClient.setQueryData(SESSION_KEY, null);
    initUserCart(null);
    router.replace('/auth/login');
  }, [initUserCart, queryClient, router]);

  return (
    <AuthContext.Provider value={{
      user,
      loading: isPending,
      error: logoutError ?? (error ? 'Không thể kiểm tra phiên đăng nhập. Vui lòng thử lại.' : null),
      isAuthenticated: !!user,
      refetchUser,
      logout,
    }}>
      {logoutError && <p role="alert" className="bg-red-50 px-4 py-2 text-center text-sm text-red-600">{logoutError}</p>}
      {children}
    </AuthContext.Provider>
  );
}

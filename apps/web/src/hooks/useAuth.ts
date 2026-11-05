'use client';

import { useContext } from 'react';
import { AuthContext } from '@/components/auth/AuthProvider';

export type { User } from '@/components/auth/AuthProvider';

export function useAuth() {
  const auth = useContext(AuthContext);
  if (!auth) throw new Error('useAuth phải được dùng bên trong AuthProvider');
  return auth;
}

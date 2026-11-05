/* eslint-disable */
'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectUrl = searchParams.get('redirect') || '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isNotRegistered, setIsNotRegistered] = useState(false);
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const EyeButton = ({ show, toggle }: { show: boolean; toggle: () => void }) => (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        toggle();
      }}
      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors focus:outline-none p-1 z-10"
      aria-label={show ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
    >
      {show ? (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
          <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
          <path d="M6.61 6.61A13.52 13.52 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
      ) : (
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsNotRegistered(false);
    setUnverifiedEmail(null);
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      const user = res.data?.user;

      // Nếu tài khoản có quyền ADMIN -> Chuyển hướng sang trang Admin
      if (user?.role === 'ADMIN') {
        window.location.href = '/admin';
      } else {
        window.location.href = redirectUrl;
      }
    } catch (err: any) {
      const status = err.response?.status;
      const errData = err.response?.data;
      const message = errData?.message || '';

      if (status === 404 || message.includes('not found') || message.includes('không tồn tại')) {
        setIsNotRegistered(true);
        setError('Tài khoản này chưa được đăng ký trong hệ thống.');
      } else if (errData?.code === 'EMAIL_NOT_VERIFIED' || message?.code === 'EMAIL_NOT_VERIFIED') {
        const targetEmail = errData?.email || message?.email || email;
        setUnverifiedEmail(targetEmail);
        setError('Tài khoản của bạn chưa được xác minh email.');
      } else {
        setError(typeof message === 'string' ? message : 'Email hoặc mật khẩu không chính xác.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50/40 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 border border-amber-100">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-amber-900">☕ BrewLite</h1>
          <p className="text-gray-500 mt-2 text-sm">Đăng nhập để tiếp tục</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200">
            {error}
            
            {isNotRegistered && (
              <div className="mt-2 pt-2 border-t border-red-200">
                <Link
                  href={`/auth/register?email=${encodeURIComponent(email)}`}
                  className="font-bold underline text-primary hover:text-primary-hover flex items-center gap-1"
                >
                  👉 Bạn có muốn đăng ký tài khoản mới với email này?
                </Link>
              </div>
            )}

            {unverifiedEmail && (
              <div className="mt-2 pt-2 border-t border-red-200">
                <Link
                  href={`/auth/verify-email?email=${encodeURIComponent(unverifiedEmail)}`}
                  className="font-semibold underline hover:text-red-800"
                >
                  👉 Nhấn vào đây để nhập mã OTP xác minh
                </Link>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nhap@email.com"
              className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-gray-700">Mật khẩu</label>
              <Link
                href="/auth/forgot-password"
                className="text-xs font-semibold text-primary hover:underline"
              >
                Quên mật khẩu?
              </Link>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none"
              />
              <EyeButton show={showPassword} toggle={() => setShowPassword(!showPassword)} />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-primary hover:bg-primary-hover text-white font-semibold rounded-xl transition disabled:opacity-50"
          >
            {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-6">
          Chưa có tài khoản?{' '}
          <Link
            href={`/auth/register${redirectUrl !== '/' ? `?redirect=${encodeURIComponent(redirectUrl)}` : ''}`}
            className="text-primary font-semibold hover:underline"
          >
            Đăng ký ngay
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="text-center p-8">Đang tải...</div>}>
      <LoginForm />
    </Suspense>
  );
}
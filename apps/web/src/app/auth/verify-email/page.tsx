/* eslint-disable */
'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';

function VerifyEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailParam = searchParams.get('email') || '';

  const [email, setEmail] = useState(emailParam);
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);

  // Đếm ngược thời gian gửi lại OTP (60 giây)
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (code.length !== 6) {
      setError('Mã OTP phải gồm 6 chữ số');
      return;
    }

    setLoading(true);
    try {
      const res = await api.post('/auth/verify-email', { email, code });
      setSuccess(res.data.message || 'Xác minh email thành công!');
      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);
    } catch (err: any) {
      setError(
        err.response?.data?.message || 'Mã OTP không chính xác hoặc đã hết hạn.'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (countdown > 0 || !email) return;
    setError('');
    setSuccess('');
    setResending(true);

    try {
      const res = await api.post('/auth/resend-verification', { email });
      setSuccess(res.data.message || 'Mã OTP mới đã được gửi!');
      setCountdown(60);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Không thể gửi lại mã OTP.');
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-amber-50/40 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8 border border-amber-100">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-amber-100 text-amber-700 rounded-full flex items-center justify-center mx-auto text-2xl font-bold mb-3">
            ✉️️
          </div>
          <h1 className="text-2xl font-bold text-amber-900">Xác minh Email</h1>
          <p className="text-gray-500 text-sm mt-1">
            Mã OTP 6 chữ số đã được gửi đến:
          </p>
          <p className="font-semibold text-gray-800">{email || 'email của bạn'}</p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-200">
            {success}
          </div>
        )}

        <form onSubmit={handleVerify} className="space-y-5">
          {!emailParam && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nhap@email.com"
                className="w-full px-4 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Mã OTP (6 chữ số)</label>
            <input
              type="text"
              required
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              className="w-full px-4 py-3 text-center text-2xl tracking-[0.5em] font-mono border border-gray-300 rounded-xl focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl shadow-md transition disabled:opacity-50"
          >
            {loading ? 'Đang xác minh...' : 'Xác minh ngay'}
          </button>
        </form>

        <div className="mt-6 text-center border-t border-gray-100 pt-4">
          <p className="text-sm text-gray-500 mb-2">Chưa nhận được mã?</p>
          <button
            type="button"
            onClick={handleResend}
            disabled={countdown > 0 || resending}
            className="text-amber-600 font-semibold hover:underline text-sm disabled:text-gray-400"
          >
            {resending
              ? 'Đang gửi...'
              : countdown > 0
              ? `Gửi lại mã sau ${countdown}s`
              : 'Gửi lại mã OTP'}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Quay lại{' '}
          <Link href="/auth/login" className="text-amber-600 hover:underline">
            Đăng nhập
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<div className="text-center p-8">Đang tải...</div>}>
      <VerifyEmailForm />
    </Suspense>
  );
}
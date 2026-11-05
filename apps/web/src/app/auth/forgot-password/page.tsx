'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

// Component Nút Con mắt khai báo BÊN NGOÀI component chính (tránh lỗi ESLint)
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

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2>(1);

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api';

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`${backendUrl}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Không thể gửi mã OTP');

      setMessage({ type: 'success', text: 'Mã OTP đã được gửi đến email của bạn!' });
      setStep(2);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Có lỗi xảy ra';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const res = await fetch(`${backendUrl}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          otp: otp.trim(),
          newPassword: newPassword.trim(),
        }),
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.message || 'Đặt lại mật khẩu thất bại!');

      setMessage({ type: 'success', text: 'Đặt lại mật khẩu thành công! Đang chuyển hướng...' });
      setTimeout(() => {
        router.push('/auth/login');
      }, 2000);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Có lỗi xảy ra';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rounded-3xl border border-primary/10 bg-surface p-8 shadow-xl">
        <h2 className="mb-2 text-center text-2xl font-extrabold text-primary">
          {step === 1 ? 'Quên mật khẩu?' : 'Đặt lại mật khẩu'}
        </h2>
        <p className="mb-6 text-center text-sm text-text/60">
          {step === 1
            ? 'Nhập email của bạn để nhận mã OTP xác thực'
            : `Nhập mã OTP đã được gửi tới ${email}`}
        </p>

        {message && (
          <div
            className={`mb-4 rounded-xl p-3 text-sm font-medium ${
              message.type === 'success'
                ? 'bg-green-50 text-green-600 border border-green-200'
                : 'bg-red-50 text-red-600 border border-red-200'
            }`}
          >
            {message.text}
          </div>
        )}

        {step === 1 ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-text">Email đăng ký</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@gmail.com"
                className="w-full rounded-xl border border-primary/15 bg-background p-3 text-sm text-text outline-none focus:border-primary"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {loading ? 'Đang gửi OTP...' : 'Gửi mã OTP'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-text">Mã OTP (6 chữ số)</label>
              <input
                type="text"
                required
                maxLength={6}
                value={otp}
                onChange={(e) => setOtp(e.target.value)}
                placeholder="123456"
                className="w-full tracking-widest text-center font-bold text-lg rounded-xl border border-primary/15 bg-background p-3 text-text outline-none focus:border-primary"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-text">Mật khẩu mới</label>
              <div className="relative">
                <input
                  type={showNewPass ? 'text' : 'password'}
                  required
                  minLength={6}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full rounded-xl border border-primary/15 bg-background p-3 pr-10 text-sm text-text outline-none focus:border-primary"
                />
                <EyeButton show={showNewPass} toggle={() => setShowNewPass(!showNewPass)} />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-primary py-3 text-sm font-bold text-white transition-colors hover:bg-primary-hover disabled:opacity-50"
            >
              {loading ? 'Đang xử lý...' : 'Xác nhận đổi mật khẩu'}
            </button>

            <button
              type="button"
              onClick={() => setStep(1)}
              className="w-full text-center text-xs text-text/60 hover:text-primary mt-2"
            >
              ← Gửi lại mã hoặc đổi email
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-xs font-semibold text-text/60">
          Quay lại{' '}
          <Link href="/auth/login" className="text-primary hover:underline">
            Đăng nhập
          </Link>
        </div>
      </div>
    </div>
  );
}
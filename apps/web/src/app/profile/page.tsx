/* eslint-disable */
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Address {
  id: string;
  recipientName: string;
  phone: string;
  detailAddress: string;
  ward?: string;
  district?: string;
  city?: string;
  isDefault: boolean;
}

interface UserProfile {
  id: string;
  email: string;
  fullName?: string;
  phone?: string;
  loyaltyPoints: number;
  addresses: Address[];
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Form Thông tin cá nhân
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Modal Thêm Địa chỉ
  const [showAddressModal, setShowAddressModal] = useState(false);
  const [addingAddress, setAddingAddress] = useState(false);
  const [newAddr, setNewAddr] = useState({
    recipientName: '',
    phone: '',
    detailAddress: '',
    ward: '',
    district: '',
    city: '',
    isDefault: false,
  });

  // Modal Đổi & Quên mật khẩu
  const [showChangePassModal, setShowChangePassModal] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passLoading, setPassLoading] = useState(false);
  const [passError, setPassError] = useState('');
  const [passSuccess, setPassSuccess] = useState('');
  const [isForgotMode, setIsForgotMode] = useState(false); 
  const [forgotStep, setForgotStep] = useState<1 | 2>(1); 
  const [otpCode, setOtpCode] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [showOldPass, setShowOldPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  // Component Nút Con mắt tối giản
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

  // Helper hàm lấy Header xác thực
  const getAuthHeaders = () => {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('token') || localStorage.getItem('accessToken')
        : null;
    return {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
  };

  // 1. Tải thông tin Profile từ Backend
  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/me', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (res.status === 401) {
        router.push('/auth/login');
        return;
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || 'Không thể tải thông tin cá nhân');
      }

      const data: UserProfile = await res.json();
      setProfile(data);
      setFullName(data.fullName || '');
      setPhone(data.phone || '');
    } catch (err: any) {
      console.error('Fetch Profile Error:', err);
      setProfileMsg({ type: 'error', text: err.message || 'Không thể kết nối đến máy chủ' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // 2. Cập nhật Họ tên & SĐT
  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProfile(true);
    setProfileMsg(null);

    try {
      const res = await fetch('/api/auth/profile', {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ fullName, phone }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'Cập nhật thất bại, vui lòng thử lại');
      }

      setProfile(data);
      setProfileMsg({ type: 'success', text: 'Đã lưu thông tin cá nhân thành công!' });
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message || 'Có lỗi xảy ra' });
    } finally {
      setSavingProfile(false);
    }
  };

  // 3. Thêm địa chỉ mới
  const handleAddAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingAddress(true);

    try {
      const res = await fetch('/api/auth/addresses', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify(newAddr),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.message || 'Không thể thêm địa chỉ mới');
      }

      setShowAddressModal(false);
      setNewAddr({
        recipientName: '',
        phone: '',
        detailAddress: '',
        ward: '',
        district: '',
        city: '',
        isDefault: false,
      });
      fetchProfile();
    } catch (err: any) {
      alert(err.message || 'Lỗi khi thêm địa chỉ');
    } finally {
      setAddingAddress(false);
    }
  };

  // 4. Đặt địa chỉ làm mặc định
  const handleSetDefaultAddress = async (addressId: string) => {
    try {
      const res = await fetch(`/api/auth/addresses/${addressId}/default`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Cập nhật thất bại');
      }
      fetchProfile();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 5. Xóa địa chỉ
  const handleDeleteAddress = async (addressId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa địa chỉ này?')) return;

    try {
      const res = await fetch(`/api/auth/addresses/${addressId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || 'Xóa địa chỉ thất bại');
      }
      fetchProfile();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Hàm gọi API Đổi mật khẩu
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (newPassword !== confirmPassword) {
      setPassError('Mật khẩu xác nhận không khớp!');
      return;
    }

    setPassLoading(true);

    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: getAuthHeaders(),
        credentials: 'include',
        body: JSON.stringify({ oldPassword, newPassword }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Thay đổi mật khẩu thất bại!');

      setPassSuccess('Đổi mật khẩu thành công!');
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setShowChangePassModal(false), 1500);
    } catch (err: any) {
      setPassError(err.message || 'Lỗi hệ thống');
    } finally {
      setPassLoading(false);
    }
  };

  // 1. Hàm gửi mã OTP về Email của tài khoản đang đăng nhập
  const handleSendForgotOtp = async () => {
    if (!profile?.email) return;
    setPassError('');
    setPassSuccess('');
    setSendingOtp(true);

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: profile.email.trim().toLowerCase() }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Không thể gửi mã OTP!');

      setPassSuccess(`Mã OTP đã được gửi về email ${profile.email}`);
      setForgotStep(2);
    } catch (err: any) {
      setPassError(err.message || 'Có lỗi xảy ra khi gửi OTP');
    } finally {
      setSendingOtp(false);
    }
  };

  // 2. Hàm xác nhận OTP và cập nhật Mật khẩu mới
  const handleResetWithOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (newPassword !== confirmPassword) {
      setPassError('Mật khẩu xác nhận không trùng khớp!');
      return;
    }

    setPassLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: profile?.email.trim().toLowerCase(),
          otp: otpCode.trim(),
          newPassword: newPassword.trim(),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message || 'Đặt lại mật khẩu thất bại!');

      setPassSuccess('Đặt lại mật khẩu thành công!');
      setTimeout(() => {
        setShowChangePassModal(false);
        setIsForgotMode(false);
        setForgotStep(1);
        setOtpCode('');
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
      }, 1500);
    } catch (err: any) {
      setPassError(err.message || 'Mã OTP không chính xác hoặc đã hết hạn');
    } finally {
      setPassLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 lg:px-8">
      {/* HEADER BẢNG ĐIỀU KHIỂN */}
      <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-text tracking-tight lg:text-3xl">Tài khoản của tôi</h1>
          <p className="mt-1 text-sm font-normal text-text/70">Quản lý thông tin cá nhân và sổ địa chỉ giao hàng</p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center text-sm font-semibold text-primary hover:underline"
        >
          ← Quay lại trang chủ
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        {/* CỘT TRÁI: THÔNG TIN TỔNG QUAN */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-primary/15 bg-surface p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-xl font-black text-primary">
                {profile?.fullName ? profile.fullName.charAt(0).toUpperCase() : '☕'}
              </div>
              <div className="overflow-hidden">
                <h2 className="truncate text-base font-bold text-text">{profile?.fullName || 'Thành viên BrewLite'}</h2>
                <p className="truncate text-xs font-normal text-text/60">{profile?.email}</p>
              </div>
            </div>

            <div className="mt-4 border-t border-primary/10 pt-4">
              <div className="flex items-center justify-between rounded-2xl bg-background p-4 border border-primary/5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-text">Điểm tích lũy</span>
                </div>
                <span className="text-base font-black text-primary">{profile?.loyaltyPoints || 0} điểm</span>
              </div>
            </div>
          </div>
        </div>

        {/* CỘT PHẢI: FORM CẬP NHẬT & SỔ ĐỊA CHỈ */}
        <div className="space-y-8 lg:col-span-2">
          {/* PHẦN 1: THÔNG TIN CÁ NHÂN */}
          <div className="rounded-3xl border border-primary/15 bg-surface p-6 shadow-sm">
            <h3 className="mb-5 border-b border-primary/10 pb-3 text-lg font-bold text-text">
              Thông tin cá nhân
            </h3>

            {profileMsg && (
              <div
                className={`mb-5 rounded-xl p-3.5 text-sm font-medium ${
                  profileMsg.type === 'success'
                    ? 'bg-green-50 border border-green-200 text-green-800'
                    : 'bg-red-50 border border-red-200 text-red-700'
                }`}
              >
                {profileMsg.text}
              </div>
            )}

            <form onSubmit={handleUpdateProfile} className="space-y-5">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-text/80">Địa chỉ Email</label>
                <input
                  type="email"
                  disabled
                  value={profile?.email || ''}
                  className="w-full rounded-xl border border-primary/10 bg-background/60 px-4 py-2.5 text-sm text-text/60 outline-none cursor-not-allowed select-none"
                />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text/80">Họ và tên</label>
                  <input
                    type="text"
                    placeholder="Nhập họ và tên..."
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-xl border border-primary/20 bg-background px-4 py-2.5 text-sm text-text outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-medium text-text/80">Số điện thoại</label>
                  <input
                    type="tel"
                    placeholder="Nhập số điện thoại..."
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full rounded-xl border border-primary/20 bg-background px-4 py-2.5 text-sm text-text outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/10"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowChangePassModal(true)}
                  className="flex items-center gap-2 rounded-xl border border-primary/20 bg-background px-4 py-2.5 text-sm font-bold text-primary hover:bg-primary/5 transition-colors"
                >
                  🔑 Đổi mật khẩu
                </button>
                <button
                  type="submit"
                  disabled={savingProfile}
                  className="rounded-xl bg-primary px-6 py-2.5 text-sm font-semibold text-white transition-all hover:bg-primary-hover active:scale-[0.98] disabled:opacity-50"
                >
                  {savingProfile ? 'Đang lưu...' : 'Lưu thay đổi'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>



      {/* MODAL ĐỔI & QUÊN MẬT KHẨU TRONG PROFILE */}
      {showChangePassModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-text">
                {isForgotMode ? 'Xác thực OTP đặt lại mật khẩu' : 'Thay đổi mật khẩu'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowChangePassModal(false);
                  setIsForgotMode(false);
                  setForgotStep(1);
                }}
                className="text-gray-400 hover:text-gray-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            {passError && <div className="mb-3 rounded-xl bg-red-50 p-2.5 text-xs font-semibold text-red-600">{passError}</div>}
            {passSuccess && <div className="mb-3 rounded-xl bg-green-50 p-2.5 text-xs font-semibold text-green-600">{passSuccess}</div>}

            {/* CHẾ ĐỘ 1: ĐỔI MẬT KHẨU THƯỜNG (CÓ MẬT KHẨU CŨ) */}
            {!isForgotMode ? (
              <form onSubmit={handleChangePassword} className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-bold text-text">Mật khẩu hiện tại</label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotMode(true);
                        handleSendForgotOtp();
                      }}
                      className="text-[11px] font-bold text-primary hover:underline"
                    >
                      Quên mật khẩu hiện tại?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showOldPass ? 'text' : 'password'}
                      required
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 p-2.5 pr-10 text-sm outline-none focus:border-primary"
                    />
                    <EyeButton show={showOldPass} toggle={() => setShowOldPass(!showOldPass)} />
                  </div>
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
                      className="w-full rounded-xl border border-gray-200 p-2.5 pr-10 text-sm outline-none focus:border-primary"
                    />
                    <EyeButton show={showNewPass} toggle={() => setShowNewPass(!showNewPass)} />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-text">Xác nhận mật khẩu mới</label>
                  <div className="relative">
                    <input
                      type={showConfirmPass ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 p-2.5 pr-10 text-sm outline-none focus:border-primary"
                    />
                    <EyeButton show={showConfirmPass} toggle={() => setShowConfirmPass(!showConfirmPass)} />
                  </div>
                </div>

                <div className="mt-6 flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowChangePassModal(false)}
                    className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-bold text-text hover:bg-gray-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={passLoading}
                    className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-white hover:bg-primary-hover disabled:opacity-50"
                  >
                    {passLoading ? 'Đang lưu...' : 'Cập nhật'}
                  </button>
                </div>
              </form>
            ) : (
              /* CHẾ ĐỘ 2: QUÊN MẬT KHẨU BẰNG XÁC THỰC OTP */
              <form onSubmit={handleResetWithOtp} className="space-y-3">
                <p className="text-xs text-text/70 mb-2">
                  Mã OTP xác nhận đang được gửi tới email <span className="font-bold text-primary">{profile?.email}</span>
                </p>

                <div>
                  <label className="mb-1 block text-xs font-bold text-text">Mã OTP (6 chữ số)</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value)}
                    placeholder="123456"
                    className="w-full rounded-xl border border-gray-200 p-2.5 text-center font-bold tracking-widest text-sm outline-none focus:border-primary"
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
                      className="w-full rounded-xl border border-gray-200 p-2.5 pr-10 text-sm outline-none focus:border-primary"
                    />
                    <EyeButton show={showNewPass} toggle={() => setShowNewPass(!showNewPass)} />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-bold text-text">Xác nhận mật khẩu mới</label>
                  <div className="relative">
                    <input
                      type={showConfirmPass ? 'text' : 'password'}
                      required
                      minLength={6}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full rounded-xl border border-gray-200 p-2.5 pr-10 text-sm outline-none focus:border-primary"
                    />
                    <EyeButton show={showConfirmPass} toggle={() => setShowConfirmPass(!showConfirmPass)} />
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={handleSendForgotOtp}
                    disabled={sendingOtp}
                    className="font-semibold text-primary hover:underline disabled:opacity-50"
                  >
                    {sendingOtp ? 'Đang gửi lại...' : 'Gửi lại mã OTP'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsForgotMode(false)}
                    className="text-gray-500 hover:underline"
                  >
                    Quay lại đổi mật khẩu cũ
                  </button>
                </div>

                <div className="mt-6 flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowChangePassModal(false);
                      setIsForgotMode(false);
                    }}
                    className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-bold text-text hover:bg-gray-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={passLoading}
                    className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-bold text-white hover:bg-primary-hover disabled:opacity-50"
                  >
                    {passLoading ? 'Đang xác nhận...' : 'Xác nhận OTP & Lưu'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
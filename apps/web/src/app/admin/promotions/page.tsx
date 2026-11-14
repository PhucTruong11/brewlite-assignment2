'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import api from '@/lib/api';
import { formatVND } from '@/lib/utils';

// Dữ liệu một voucher trả về từ GET /admin/promotions
interface PromotionItem {
    id: string;
    code: string;
    description: string | null;
    discountType: 'PERCENTAGE' | 'FIXED_AMOUNT' | string;
    discountValue: number;
    minOrderValue: number;
    maxDiscount: number | null;
    startDate: string;
    endDate: string | null;
    isActive: boolean;
    isRewardOnly: boolean;
    pointsCost: number | null;
    canEditTerms: boolean;
}

// Trạng thái ban đầu của form tạo voucher
const EMPTY_FORM = {
    code: '',
    description: '',
    discountType: 'PERCENTAGE' as 'PERCENTAGE' | 'FIXED_AMOUNT',
    discountValue: '',
    minOrderValue: '',
    maxDiscount: '',
    endDate: '', // định dạng yyyy-mm-dd từ <input type="date">
    pointsCost: '',
};

// Lấy thông báo lỗi dễ đọc từ phản hồi của backend (NestJS trả message là chuỗi hoặc mảng)
function getErrorMessage(error: unknown): string {
    if (axios.isAxiosError(error)) {
        const msg = error.response?.data?.message;
        if (Array.isArray(msg)) return msg.join('. ');
        if (typeof msg === 'string') return msg;
    }
    return 'Có lỗi xảy ra, vui lòng thử lại';
}

// Voucher đã quá hạn nếu có endDate và endDate < hiện tại
function isExpired(p: PromotionItem): boolean {
    return !!p.endDate && new Date(p.endDate).getTime() <= Date.now();
}

// Ngày nhập trên form luôn tính đến 23:59:59 theo giờ Việt Nam.
function dateInputValue(date: Date): string {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
    }).formatToParts(date);
    const value = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
    return `${value('year')}-${value('month')}-${value('day')}`;
}

function formatDiscount(p: PromotionItem): string {
    return p.discountType === 'PERCENTAGE'
        ? `${p.discountValue}%${p.maxDiscount ? ` (tối đa ${formatVND(p.maxDiscount)})` : ''}`
        : formatVND(p.discountValue);
}

export default function AdminPromotionsPage() {
    const queryClient = useQueryClient();
    const [form, setForm] = useState(EMPTY_FORM);
    const [formError, setFormError] = useState<string | null>(null);
    const [editing, setEditing] = useState<PromotionItem | null>(null);
    const canEditTerms = editing?.canEditTerms ?? true;
    const today = dateInputValue(new Date());
    const originalEndDate = editing?.endDate ? dateInputValue(new Date(editing.endDate)) : '';

    // Lấy danh sách voucher
    const { data: promotions = [], isLoading, isError } = useQuery({
        queryKey: ['admin-promotions'],
        queryFn: async () => {
            const res = await api.get<{ data: PromotionItem[] }>('/admin/promotions');
            return res.data.data;
        },
    });

    const resetForm = () => {
        setEditing(null);
        setForm(EMPTY_FORM);
        setFormError(null);
    };

    const refreshLists = () => Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-promotions'] }),
        queryClient.invalidateQueries({ queryKey: ['rewards'] }),
    ]);

    const saveMutation = useMutation({
        mutationFn: async () => {
            const description = form.description.trim() || null;
            const payload: Record<string, unknown> = {};
            if (!editing || description !== editing.description) payload.description = description;
            if (canEditTerms) {
                const discountValue = Number(form.discountValue);
                const minOrderValue = Number(form.minOrderValue);
                const maxDiscount = form.discountType === 'PERCENTAGE' && form.maxDiscount
                    ? Number(form.maxDiscount) : null;
                if (!editing || form.discountType !== editing.discountType) payload.discountType = form.discountType;
                if (!editing || discountValue !== editing.discountValue) payload.discountValue = discountValue;
                if (!editing || minOrderValue !== editing.minOrderValue) payload.minOrderValue = minOrderValue;
                if (!editing || maxDiscount !== editing.maxDiscount) payload.maxDiscount = maxDiscount;
                if (form.endDate !== originalEndDate) payload.endDate = form.endDate || null;
            }
            const pointsCost = Number(form.pointsCost);
            if (form.pointsCost && (!editing || (editing.isRewardOnly && pointsCost !== editing.pointsCost))) {
                payload.pointsCost = pointsCost;
            }
            if (editing) return api.patch(`/admin/promotions/${editing.id}`, payload);
            return api.post('/admin/promotions', { ...payload, code: form.code.trim() });
        },
        onSuccess: async () => {
            resetForm();
            await refreshLists();
        },
        onError: (error) => setFormError(getErrorMessage(error)),
    });

    // Bật / tắt voucher
    const toggleMutation = useMutation({
        mutationFn: async (id: string) => api.patch(`/admin/promotions/${id}/active`),
        onSuccess: refreshLists,
        onError: (error) => alert(getErrorMessage(error)),
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        // Kiểm tra nhanh ở client; backend vẫn validate lại
        if (!form.code.trim()) return setFormError('Vui lòng nhập mã voucher');
        if (canEditTerms) {
            const value = Number(form.discountValue);
            if (!form.discountValue || !Number.isFinite(value) || value <= 0) {
                return setFormError('Giá trị giảm phải lớn hơn 0');
            }
            if (form.discountType === 'PERCENTAGE' && value > 100) {
                return setFormError('Giảm theo % không được vượt quá 100');
            }
            if (form.endDate && form.endDate !== originalEndDate && form.endDate < today) {
                return setFormError('Hạn dùng voucher không được là ngày đã qua');
            }
        }
        if (editing?.isRewardOnly || form.pointsCost) {
            const points = Number(form.pointsCost);
            if (!Number.isInteger(points) || points <= 0) {
                return setFormError('Điểm đổi thưởng phải là số nguyên lớn hơn 0');
            }
        }
        setFormError(null);
        saveMutation.mutate();
    };

    const setField = (key: keyof typeof EMPTY_FORM, value: string) =>
        setForm((f) => ({ ...f, [key]: value }));

    const startEditing = (promotion: PromotionItem) => {
        setEditing(promotion);
        setForm({
            code: promotion.code,
            description: promotion.description ?? '',
            discountType: promotion.discountType === 'FIXED_AMOUNT' ? 'FIXED_AMOUNT' : 'PERCENTAGE',
            discountValue: String(promotion.discountValue),
            minOrderValue: String(promotion.minOrderValue),
            maxDiscount: promotion.maxDiscount === null ? '' : String(promotion.maxDiscount),
            endDate: promotion.endDate ? dateInputValue(new Date(promotion.endDate)) : '',
            pointsCost: promotion.pointsCost === null ? '' : String(promotion.pointsCost),
        });
        setFormError(null);
        document.getElementById('voucher-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };

    const inputClass =
        'w-full rounded-lg border border-primary/20 bg-white px-3 py-2 text-sm outline-none focus:border-primary';

    return (
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 lg:px-8">
            <h1 className="text-2xl font-extrabold tracking-tight text-text">Quản lý voucher</h1>
            <form
                id="voucher-form"
                onSubmit={handleSubmit}
                className="mt-6 grid gap-4 rounded-2xl bg-surface p-4 shadow-sm md:grid-cols-2 lg:grid-cols-3"
            >
                <label className="text-sm font-semibold">
                    Mã voucher
                    <input
                        className={`${inputClass} mt-1 uppercase`}
                        value={form.code}
                        readOnly={editing !== null}
                        onChange={(e) => setField('code', e.target.value)}
                        placeholder="VD: SUMMER10"
                    />
                </label>

                {(!editing || editing.isRewardOnly) && (
                    <div>
                        <label htmlFor="pointsCost" className="block text-sm font-semibold">Điểm đổi thưởng</label>
                        <input
                            id="pointsCost"
                            type="number"
                            min={1}
                            max={2_147_483_647}
                            step={1}
                            className={`${inputClass} mt-1`}
                            value={form.pointsCost}
                            onChange={(e) => setField('pointsCost', e.target.value)}
                            placeholder="Ví dụ: 100 điểm"
                            aria-describedby="voucher-points-help"
                        />
                        <p id="voucher-points-help" className="mt-1 text-xs text-text/65">
                            {editing ? 'Áp dụng cho những lượt đổi tiếp theo.' : 'Để trống để tạo voucher áp dụng chung.'}
                        </p>
                    </div>
                )}

                <label className="text-sm font-semibold">
                    Loại giảm giá
                    <select
                        className={`${inputClass} mt-1`}
                        disabled={!canEditTerms}
                        value={form.discountType}
                        onChange={(e) => setField('discountType', e.target.value)}
                    >
                        <option value="PERCENTAGE">Giảm theo %</option>
                        <option value="FIXED_AMOUNT">Giảm số tiền cố định</option>
                    </select>
                </label>

                <label className="text-sm font-semibold">
                    Giá trị giảm {form.discountType === 'PERCENTAGE' ? '(%)' : '(VNĐ)'}
                    <input
                        type="number"
                        min={0}
                        className={`${inputClass} mt-1`}
                        disabled={!canEditTerms}
                        value={form.discountValue}
                        onChange={(e) => setField('discountValue', e.target.value)}
                    />
                </label>

                <label className="text-sm font-semibold">
                    Đơn tối thiểu (VNĐ)
                    <input
                        type="number"
                        min={0}
                        className={`${inputClass} mt-1`}
                        disabled={!canEditTerms}
                        value={form.minOrderValue}
                        onChange={(e) => setField('minOrderValue', e.target.value)}
                        placeholder="0"
                    />
                </label>

                {/* Giảm tối đa chỉ có ý nghĩa với voucher theo % */}
                {form.discountType === 'PERCENTAGE' && (
                    <label className="text-sm font-semibold">
                        Giảm tối đa (VNĐ)
                        <input
                            type="number"
                            min={0}
                            className={`${inputClass} mt-1`}
                            disabled={!canEditTerms}
                            value={form.maxDiscount}
                            onChange={(e) => setField('maxDiscount', e.target.value)}
                            placeholder="Không giới hạn"
                        />
                    </label>
                )}

                <label className="text-sm font-semibold">
                    Hạn dùng (để trống = không hết hạn)
                    <input
                        type="date"
                        min={originalEndDate && form.endDate === originalEndDate && originalEndDate < today ? originalEndDate : today}
                        className={`${inputClass} mt-1`}
                        disabled={!canEditTerms}
                        value={form.endDate}
                        onChange={(e) => setField('endDate', e.target.value)}
                    />
                </label>

                {!canEditTerms && (
                    <p className="text-xs text-amber-800 md:col-span-2 lg:col-span-3">
                        Voucher đã được phát hành hoặc sử dụng. Bạn có thể sửa mô tả{editing?.isRewardOnly && ' và điểm cần cho lượt đổi mới'}.
                    </p>
                )}

                <label className="text-sm font-semibold md:col-span-2 lg:col-span-3">
                    Mô tả
                    <input
                        className={`${inputClass} mt-1`}
                        value={form.description}
                        onChange={(e) => setField('description', e.target.value)}
                        placeholder="VD: Giảm 10% cho đơn từ 50.000đ"
                    />
                </label>

                <div className="flex flex-wrap items-center gap-3 md:col-span-2 lg:col-span-3">
                    <button
                        type="submit"
                        disabled={saveMutation.isPending}
                        className="rounded-lg bg-primary px-5 py-2 text-sm font-semibold text-white disabled:opacity-60"
                    >
                        {saveMutation.isPending ? 'Đang lưu…' : editing ? 'Lưu thay đổi' : 'Tạo voucher'}
                    </button>
                    {editing && (
                        <button
                            type="button"
                            disabled={saveMutation.isPending}
                            onClick={resetForm}
                            className="rounded-lg border border-primary/30 px-4 py-2 text-sm font-semibold"
                        >
                            Hủy sửa
                        </button>
                    )}
                    {formError && <p role="alert" className="text-sm text-red-600">{formError}</p>}
                </div>
            </form>

            {/* ===== Danh sách voucher ===== */}
            <h2 className="mt-8 text-lg font-bold text-text">Danh sách voucher ({promotions.length})</h2>

            {isLoading && <p className="mt-3 text-sm text-text/70">Đang tải...</p>}
            {isError && <p className="mt-3 text-sm text-red-600">Không tải được danh sách voucher.</p>}
            {!isLoading && !isError && promotions.length === 0 && (
                <p className="mt-3 text-sm text-text/70">Chưa có voucher nào.</p>
            )}

            <div className="mt-3 overflow-x-auto rounded-2xl bg-surface shadow-sm">
                <table className="w-full min-w-[780px] text-left text-sm">
                    <thead className="border-b border-primary/10 text-xs uppercase text-text/60">
                        <tr>
                            <th className="px-4 py-3">Mã</th>
                            <th className="px-4 py-3">Giảm</th>
                            <th className="px-4 py-3">Đơn tối thiểu</th>
                            <th className="px-4 py-3">Hạn dùng</th>
                            <th className="px-4 py-3">Trạng thái</th>
                            <th className="px-4 py-3 text-right">Thao tác</th>
                        </tr>
                    </thead>
                    <tbody>
                        {promotions.map((p) => {
                            const expired = isExpired(p);
                            return (
                                <tr key={p.id} className="border-b border-primary/5 last:border-0">
                                    <td className="px-4 py-3">
                                        <p className="font-bold">{p.code}</p>
                                        {p.description && <p className="text-xs text-text/60">{p.description}</p>}
                                        {p.isRewardOnly && (
                                            <span className="text-xs font-semibold text-primary">
                                                {p.pointsCost === null ? 'Chưa cấu hình điểm đổi' : `${p.pointsCost.toLocaleString('vi-VN')} điểm để đổi`}
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">{formatDiscount(p)}</td>
                                    <td className="px-4 py-3">{formatVND(p.minOrderValue)}</td>
                                    <td className="px-4 py-3">
                                        {p.endDate ? new Date(p.endDate).toLocaleDateString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Không giới hạn'}
                                    </td>
                                    <td className="px-4 py-3">
                                        {expired ? (
                                            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-xs font-semibold">Hết hạn</span>
                                        ) : p.isActive ? (
                                            <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700">Đang bật</span>
                                        ) : (
                                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-700">Đã tắt</span>
                                        )}
                                    </td>
                                    <td className="whitespace-nowrap px-4 py-3 text-right">
                                        <button
                                            type="button"
                                            disabled={saveMutation.isPending}
                                            onClick={() => startEditing(p)}
                                            className="mr-1 rounded-lg border border-primary/30 px-3 py-1 text-xs font-semibold hover:bg-background disabled:opacity-60"
                                        >
                                            Sửa
                                        </button>
                                        <button
                                            type="button"
                                            disabled={toggleMutation.isPending}
                                            onClick={() => toggleMutation.mutate(p.id)}
                                            className="rounded-lg border border-primary/30 px-3 py-1 text-xs font-semibold hover:bg-background disabled:opacity-60"
                                        >
                                            {p.isActive ? 'Tắt' : 'Bật'}
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </main>
    );
}

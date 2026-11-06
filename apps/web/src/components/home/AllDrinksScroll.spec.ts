import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  useProducts: vi.fn(),
  useCategories: vi.fn(),
  useSearchParams: vi.fn(),
}));

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useSyncExternalStore: () => true,
}));
vi.mock('next/navigation', () => ({ useSearchParams: mocks.useSearchParams }));
vi.mock('@/hooks/useProducts', () => ({ useProducts: mocks.useProducts }));
vi.mock('@/hooks/useCategories', () => ({ useCategories: mocks.useCategories }));
vi.mock('@/components/product/ProductCard', () => ({
  ProductCard: ({ product }: { product: { name: string } }) => product.name,
}));

import { AllDrinksScroll } from './AllDrinksScroll';

const renderMenu = () => renderToStaticMarkup(createElement(AllDrinksScroll));

describe('Danh sách đồ uống trên menu', () => {
  beforeEach(() => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams());
    mocks.useCategories.mockReturnValue({ categories: [] });
    mocks.useProducts.mockReturnValue({ data: undefined, isLoading: false, isError: false });
  });

  it('hiển thị khung chờ trong lúc tải sản phẩm', () => {
    mocks.useProducts.mockReturnValue({ data: undefined, isLoading: true, isError: false });
    expect(renderMenu()).toContain('animate-pulse');
  });

  it('hiển thị lỗi khi API menu không tải được', () => {
    mocks.useProducts.mockReturnValue({ data: undefined, isLoading: false, isError: true });
    expect(renderMenu()).toContain('Không tải được danh sách đồ uống');
  });

  it('hiển thị thông báo rỗng theo từ khóa tìm kiếm', () => {
    mocks.useSearchParams.mockReturnValue(new URLSearchParams('q=phin'));
    mocks.useProducts.mockReturnValue({ data: [], isLoading: false, isError: false });
    expect(renderMenu()).toContain('Không tìm thấy món nào khớp');
    expect(renderMenu()).toContain('phin');
  });

  it('hiển thị món khi API trả danh sách', () => {
    mocks.useProducts.mockReturnValue({
      data: [{ id: 'product-1', name: 'Phin Sữa Đá' }], isLoading: false, isError: false,
    });
    expect(renderMenu()).toContain('Phin Sữa Đá');
  });
});

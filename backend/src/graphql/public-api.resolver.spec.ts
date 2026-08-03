import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PublicApiResolver } from './public-api.resolver';

function buildPublicApiServiceMock() {
  return {
    getProducts: vi.fn(),
    getSales: vi.fn(),
    getStock: vi.fn(),
  };
}

describe('PublicApiResolver', () => {
  let publicApiService: ReturnType<typeof buildPublicApiServiceMock>;
  let resolver: PublicApiResolver;

  beforeEach(() => {
    publicApiService = buildPublicApiServiceMock();
    resolver = new PublicApiResolver(publicApiService as any);
  });

  it('délègue products() au PublicApiService avec le tenantId du contexte', async () => {
    publicApiService.getProducts.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 });

    await resolver.products({ tenantId: 'tenant-1' }, 1, 20);

    expect(publicApiService.getProducts).toHaveBeenCalledWith('tenant-1', { page: 1, pageSize: 20 });
  });

  it('délègue sales() au PublicApiService avec le tenantId du contexte', async () => {
    publicApiService.getSales.mockResolvedValue({ items: [], total: 0, page: 1, pageSize: 20, totalPages: 1 });

    await resolver.sales({ tenantId: 'tenant-1' }, 2, 10);

    expect(publicApiService.getSales).toHaveBeenCalledWith('tenant-1', { page: 2, pageSize: 10 });
  });

  it('aplati la structure imbriquée (product.name, store.name) en productName/storeName pour stock()', async () => {
    publicApiService.getStock.mockResolvedValue({
      items: [
        {
          productId: 'p1',
          storeId: 's1',
          stock: 12,
          product: { name: 'Riz 5kg' },
          store: { name: 'Bamako' },
        },
      ],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });

    const result = await resolver.stock({ tenantId: 'tenant-1' }, 1, 20);

    expect(result.items[0]).toEqual({
      productId: 'p1',
      productName: 'Riz 5kg',
      storeId: 's1',
      storeName: 'Bamako',
      stock: 12,
    });
    expect(result.total).toBe(1);
  });
});

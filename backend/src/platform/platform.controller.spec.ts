import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlatformController } from './platform.controller';

function buildSubscriptionServiceMock() {
  return { confirmPayment: vi.fn() };
}

describe('PlatformController', () => {
  let subscriptionService: ReturnType<typeof buildSubscriptionServiceMock>;
  let controller: PlatformController;

  beforeEach(() => {
    subscriptionService = buildSubscriptionServiceMock();
    controller = new PlatformController(subscriptionService as any);
  });

  it('délègue la confirmation de paiement à SubscriptionService.confirmPayment', async () => {
    subscriptionService.confirmPayment.mockResolvedValue({ id: 'sub-1', plan: 'STARTER' });

    const result = await controller.confirmPayment('inv-1');

    expect(subscriptionService.confirmPayment).toHaveBeenCalledWith('inv-1');
    expect(result.plan).toBe('STARTER');
  });
});

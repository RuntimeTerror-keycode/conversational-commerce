import { MasterOrderRepository, CustomerRepository } from '@cc/domain';
import { Logger } from '../logger/logger';
import { NotifyService } from './notify.service';

/**
 * Fulfillment rows default to 'accepted' on creation (auto-accept, per
 * spec.md) — there's no separate dashboard "accept" action to hang this off
 * of, so it fires right after OrderPlacementService.createOrder succeeds.
 */
export class OrderNotifyService {
  private readonly masterOrderRepo: MasterOrderRepository;
  private readonly customerRepo: CustomerRepository;
  private readonly notifyService: NotifyService;
  private readonly logger: Logger;

  constructor(
    masterOrderRepo: MasterOrderRepository,
    customerRepo: CustomerRepository,
    notifyService: NotifyService,
    logger: Logger,
  ) {
    this.masterOrderRepo = masterOrderRepo;
    this.customerRepo = customerRepo;
    this.notifyService = notifyService;
    this.logger = logger.child('OrderNotifyService');
  }

  public async notifyOrderAccepted(orderId: string, etaMinutes: number): Promise<void> {
    const id = parseInt(orderId, 10);
    if (isNaN(id)) return;

    const order = await this.masterOrderRepo.findById(id);
    if (!order) {
      this.logger.warn('Cannot notify — order not found', { orderId });
      return;
    }

    const customer = await this.customerRepo.findById(order.customer_id);
    if (!customer) {
      this.logger.warn('Cannot notify — customer not found', { orderId, customerId: order.customer_id });
      return;
    }

    const shopNames = order.confirmed_snapshot?.assignments?.map((a) => a.shopName) ?? [];
    const shopClause = shopNames.length > 0 ? ` by *${shopNames.join(' & ')}*` : '';

    const body = [
      '✅ *Order Confirmed!*',
      `Your order \`${order.order_code}\` has been accepted${shopClause} and is being prepared.`,
      '',
      `⏱️ Estimated delivery: *~${etaMinutes} minutes*`,
      '',
      'Thanks for shopping with us! 🛒',
    ].join('\n');

    await this.notifyService.send(customer.phone, [{ type: 'text', body }], 'order_accepted', order.trace_id);
  }
}

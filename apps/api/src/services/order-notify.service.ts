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

    const assignments = order.confirmed_snapshot?.assignments ?? [];
    const body =
      assignments.length > 1
        ? [
            '✅ *Order Confirmed!*',
            `Your order \`${order.order_code}\` has been accepted — it'll come as ${assignments.length} separate deliveries from ${assignments.length} stores:`,
            ...assignments.map((a, i) => `• Store ${i + 1} — ${a.items.length} item${a.items.length === 1 ? '' : 's'}, ₹${a.subtotal}`),
            '',
            `⏱️ Estimated delivery: *~${etaMinutes} minutes* each`,
            '',
            'Need an update? Just reach out to us with this order number.',
            '',
            'Thanks for shopping with us! 🛒',
          ].join('\n')
        : [
            '✅ *Order Confirmed!*',
            `Your order \`${order.order_code}\` has been accepted and is being prepared.`,
            '',
            `⏱️ Estimated delivery: *~${etaMinutes} minutes*`,
            '',
            'Thanks for shopping with us! 🛒',
          ].join('\n');

    await this.notifyService.send(customer.phone, [{ type: 'text', body }], 'order_accepted', order.trace_id);
  }
}

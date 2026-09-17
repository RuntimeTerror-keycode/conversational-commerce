import {
  AppError,
  FulfillmentRepository,
  OrderItemRepository,
  OrderEventRepository,
  ShopProductRepository,
  ShopRepository,
  IDatabase,
} from '@cc/domain';
import { Logger } from '../logger/logger';
import {
  FulfillmentListResponse,
  FulfillmentDetail,
  FulfillmentCounts,
  FulfillmentStatus,
} from '../types';
import {
  fulfillmentStatuses,
  fulfillmentTransitions,
  fulfillmentTimestampColumn,
  dashboardSettableStatuses,
} from '../constants';
import { NotifyService } from './notify.service';

// ---------------------------------------------------------------------------
// Params
// ---------------------------------------------------------------------------

export interface FulfillmentListQuery {
  shopId: number;
  status?: string;
  since?: string;
  page: number;
  limit: number;
}

export interface LineItemUpdate {
  shopId: number;
  fulfillmentId: number;
  lineId: number;
  quantity?: number;
  substituteProductId?: number;
  remove?: boolean;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class FulfillmentService {
  private readonly fulfillmentRepo: FulfillmentRepository;
  private readonly orderItemRepo: OrderItemRepository;
  private readonly orderEventRepo: OrderEventRepository;
  private readonly shopProductRepo: ShopProductRepository;
  private readonly shopRepo: ShopRepository;
  private readonly db: IDatabase;
  private readonly notifyService: NotifyService;
  private readonly logger: Logger;

  constructor(
    fulfillmentRepo: FulfillmentRepository,
    orderItemRepo: OrderItemRepository,
    orderEventRepo: OrderEventRepository,
    shopProductRepo: ShopProductRepository,
    shopRepo: ShopRepository,
    db: IDatabase,
    notifyService: NotifyService,
    logger: Logger,
  ) {
    this.fulfillmentRepo = fulfillmentRepo;
    this.orderItemRepo = orderItemRepo;
    this.orderEventRepo = orderEventRepo;
    this.shopProductRepo = shopProductRepo;
    this.shopRepo = shopRepo;
    this.db = db;
    this.notifyService = notifyService;
    this.logger = logger.child('FulfillmentService');
  }

  public async list(query: FulfillmentListQuery): Promise<FulfillmentListResponse> {
    const { shopId, status, since, page, limit } = query;
    const offset = (page - 1) * limit;

    if (status && !fulfillmentStatuses.includes(status as FulfillmentStatus)) {
      throw AppError.validation(`Invalid status filter. Must be one of: ${fulfillmentStatuses.join(', ')}`);
    }

    const [rows, total, statusRows] = await Promise.all([
      this.fulfillmentRepo.findByShop({ shopId, status, since, limit, offset }),
      this.fulfillmentRepo.countByShop(shopId, status, since),
      this.fulfillmentRepo.statusCountsByShop(shopId),
    ]);

    const counts: FulfillmentCounts = {
      accepted: 0, packed: 0, out_for_delivery: 0, delivered: 0, rejected: 0,
    };
    for (const row of statusRows) {
      if (row.status in counts) {
        counts[row.status as FulfillmentStatus] = row.count;
      }
    }

    return {
      data: rows.map((row) => ({
        id: row.id,
        orderCode: row.order_code,
        status: row.status as FulfillmentStatus,
        customer: { displayName: row.customer_name, phone: row.customer_phone },
        itemCount: row.item_count,
        subtotal: parseFloat(row.subtotal),
        deliveryType: row.delivery_type,
        acceptedAt: row.accepted_at?.toISOString() ?? null,
        updatedAt: row.updated_at?.toISOString() ?? null,
      })),
      page: { page, limit, total, hasMore: offset + limit < total },
      counts,
      serverTime: new Date().toISOString(),
    };
  }

  public async detail(fulfillmentId: number, shopId: number): Promise<FulfillmentDetail> {
    const f = await this.fulfillmentRepo.findById(fulfillmentId, shopId);
    if (!f) {
      throw AppError.notFound('Fulfillment not found');
    }

    const [items, events] = await Promise.all([
      this.orderItemRepo.findByFulfillment(fulfillmentId),
      this.orderEventRepo.findByFulfillment(fulfillmentId),
    ]);

    return {
      id: f.id,
      orderCode: f.order_code,
      status: f.status as FulfillmentStatus,
      customer: { displayName: f.customer_name, phone: f.customer_phone },
      items: items.map((item) => ({
        lineId: item.lineId,
        shopProductId: item.shopProductId,
        productName: item.productName,
        catalogName: item.catalogName,
        quantity: item.quantity,
        unit: item.unit,
        unitPrice: parseFloat(item.unitPrice),
        lineTotal: parseFloat(item.lineTotal),
        sourceText: null,
      })),
      subtotal: parseFloat(f.subtotal),
      delivery: {
        type: f.delivery_type,
        address: f.address_line,
        city: f.city,
        note: f.delivery_note,
      },
      payment: { method: f.payment_mode, status: 'pending' },
      timeline: {
        acceptedAt: f.accepted_at?.toISOString() ?? null,
        packedAt: f.packed_at?.toISOString() ?? null,
        outForDeliveryAt: f.out_for_delivery_at?.toISOString() ?? null,
        deliveredAt: f.delivered_at?.toISOString() ?? null,
        rejectedAt: f.rejected_at?.toISOString() ?? null,
      },
      rejectionReason: f.rejection_reason,
      events: events.map((e) => ({
        id: e.id,
        eventType: e.eventType,
        actor: e.actor,
        note: e.note,
        createdAt: e.createdAt.toISOString(),
      })),
      traceId: f.trace_id,
      updatedAt: f.updated_at?.toISOString() ?? null,
    };
  }

  public async updateStatus(fulfillmentId: number, shopId: number, targetStatus: string): Promise<FulfillmentDetail> {
    if (!targetStatus || !fulfillmentStatuses.includes(targetStatus as FulfillmentStatus)) {
      throw AppError.validation(`status must be one of: ${dashboardSettableStatuses.join(', ')}`);
    }

    if (!dashboardSettableStatuses.includes(targetStatus as FulfillmentStatus)) {
      throw AppError.validation('Dashboard cannot set accepted or rejected');
    }

    const current = await this.fulfillmentRepo.findStatus(fulfillmentId, shopId);
    if (!current) {
      throw AppError.notFound('Fulfillment not found');
    }

    const expectedNext = fulfillmentTransitions[current.status as FulfillmentStatus];
    if (expectedNext !== targetStatus) {
      throw AppError.conflict(
        `Cannot transition from ${current.status} to ${targetStatus}`,
        { currentStatus: current.status, expectedNext },
      );
    }

    const tsCol = fulfillmentTimestampColumn[targetStatus];

    await this.db.transaction(async (client) => {
      await this.fulfillmentRepo.setStatus(client, fulfillmentId, shopId, targetStatus, tsCol);
      await this.orderEventRepo.insert(client, fulfillmentId, `status_${targetStatus}`, 'retailer', `Status changed to ${targetStatus}`);
    });

    this.logger.info('Fulfillment status updated', {
      fulfillmentId, shopId, from: current.status, to: targetStatus,
    });

    const detail = await this.detail(fulfillmentId, shopId);

    if (targetStatus === 'out_for_delivery') {
      const shop = await this.shopRepo.findById(shopId);
      const shopName = shop?.name ?? 'the shop';
      const body = [
        '🚚 *Out for Delivery!*',
        `Your order \`${detail.orderCode}\` from *${shopName}* is on its way!`,
        '',
        `📍 Delivering to: ${detail.delivery.address ?? 'your address'}`,
        '',
        "It'll be with you shortly. 😊",
      ].join('\n');

      await this.notifyService.send(detail.customer.phone, [{ type: 'text', body }], 'out_for_delivery', detail.traceId);
    }

    return detail;
  }

  public async updateItem(params: LineItemUpdate): Promise<FulfillmentDetail> {
    const { shopId, fulfillmentId, lineId, quantity, substituteProductId, remove } = params;

    const fulfillment = await this.fulfillmentRepo.findStatus(fulfillmentId, shopId);
    if (!fulfillment) {
      throw AppError.notFound('Fulfillment not found');
    }
    if (fulfillment.status !== 'accepted') {
      throw AppError.conflict('Line items can only be edited while fulfillment is accepted');
    }

    const item = await this.orderItemRepo.findById(lineId, fulfillmentId);
    if (!item) {
      throw AppError.notFound('Line item not found');
    }

    let substitution: { oldName: string; newName: string } | null = null;

    if (remove) {
      await this.orderItemRepo.delete(lineId);
    } else if (substituteProductId) {
      const product = await this.shopProductRepo.findForSubstitute(substituteProductId, shopId);
      if (!product) {
        throw AppError.notFound('Substitute product not found in this shop');
      }
      const existingItems = await this.orderItemRepo.findByFulfillment(fulfillmentId);
      const oldName = existingItems.find((i) => i.lineId === lineId)?.productName ?? 'an item';
      const qty = await this.orderItemRepo.getQuantity(lineId);
      const newPrice = parseFloat(product.selling_price);
      await this.orderItemRepo.substitute(lineId, substituteProductId, newPrice, newPrice * qty);
      substitution = { oldName, newName: product.local_name ?? 'a substitute item' };
    } else if (quantity !== undefined) {
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw AppError.validation('quantity must be a positive integer');
      }
      const unitPrice = parseFloat(item.unit_price);
      await this.orderItemRepo.updateQuantity(lineId, quantity, unitPrice * quantity);
    } else {
      throw AppError.validation('Provide quantity, substituteProductId, or remove');
    }

    await this.fulfillmentRepo.recalcSubtotal(fulfillmentId);

    this.logger.info('Line item updated', { fulfillmentId, lineId, shopId });

    const detail = await this.detail(fulfillmentId, shopId);

    if (substitution) {
      const shop = await this.shopRepo.findById(shopId);
      const shopName = shop?.name ?? 'the shop';
      const body = [
        '🔄 *Item Substituted*',
        `In your order \`${detail.orderCode}\` from *${shopName}*:`,
        '',
        `~${substitution.oldName}~ → *${substitution.newName}*`,
        '',
        "We made this swap to keep your order moving — reach out if you'd prefer something else!",
      ].join('\n');

      await this.notifyService.send(detail.customer.phone, [{ type: 'text', body }], 'substitution', detail.traceId);
    }

    return detail;
  }
}

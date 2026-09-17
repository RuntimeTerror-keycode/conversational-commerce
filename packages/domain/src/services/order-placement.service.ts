import { createHash, randomBytes } from 'crypto';
import { PoolClient } from 'pg';

import { AppError } from '../lib/app-error';
import {
  IDatabase,
  ILogger,
  CartItemDetailRow,
  OrderConfirmationResponse,
  CreateOrderResponse,
  DomainCartLine,
  ShopBreakdownEntry,
  ConfirmedSnapshot,
  SnapshotAssignment,
} from '../types';
import { CartRepository } from '../repositories/cart.repository';
import { CustomerRepository } from '../repositories/customer.repository';
import { FulfillmentRepository } from '../repositories/fulfillment.repository';
import { MasterOrderRepository } from '../repositories/master-order.repository';
import { OrderEventRepository } from '../repositories/order-event.repository';
import { OrderItemRepository } from '../repositories/order-item.repository';
import { ShopRepository } from '../repositories/shop.repository';
import { generateOrderCode } from '../lib/order-code';
import {
  confirmationTokenTtlMinutes,
  defaultEtaMinutes,
  minFulfillmentAmount,
} from '../constants';

export class OrderPlacementService {
  private readonly cartRepo: CartRepository;
  private readonly customerRepo: CustomerRepository;
  private readonly shopRepo: ShopRepository;
  private readonly masterOrderRepo: MasterOrderRepository;
  private readonly fulfillmentRepo: FulfillmentRepository;
  private readonly orderItemRepo: OrderItemRepository;
  private readonly orderEventRepo: OrderEventRepository;
  private readonly db: IDatabase;
  private readonly logger: ILogger;

  constructor(deps: {
    cartRepo: CartRepository;
    customerRepo: CustomerRepository;
    shopRepo: ShopRepository;
    masterOrderRepo: MasterOrderRepository;
    fulfillmentRepo: FulfillmentRepository;
    orderItemRepo: OrderItemRepository;
    orderEventRepo: OrderEventRepository;
    db: IDatabase;
    logger: ILogger;
  }) {
    this.cartRepo = deps.cartRepo;
    this.customerRepo = deps.customerRepo;
    this.shopRepo = deps.shopRepo;
    this.masterOrderRepo = deps.masterOrderRepo;
    this.fulfillmentRepo = deps.fulfillmentRepo;
    this.orderItemRepo = deps.orderItemRepo;
    this.orderEventRepo = deps.orderEventRepo;
    this.db = deps.db;
    this.logger = deps.logger.child('OrderPlacementService');
  }

  /**
   * Snapshot the cart, run the splitting algorithm, persist the
   * snapshot on the draft order, and return a confirmation token.
   */
  public async requestConfirmation(
    customerId: string,
    nearbyShopIds: string[],
  ): Promise<OrderConfirmationResponse> {
    const customer = await this.customerRepo.findByPhone(customerId);
    if (!customer) throw AppError.notFound('Customer not found');

    const cartId = await this.cartRepo.findOrCreate(customer.id);
    const cartItems = await this.cartRepo.findItems(cartId);

    if (cartItems.length === 0) {
      throw AppError.validation('Cart is empty');
    }

    const shopIds = nearbyShopIds.map((id) => parseInt(id, 10));
    const assignments = await this.splitAcrossShops(cartItems, shopIds);

    if (assignments.length === 0) {
      throw AppError.validation('No shops can fulfill any items in the cart');
    }

    const totalAmount = assignments.reduce((sum, a) => sum + a.subtotal, 0);
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + confirmationTokenTtlMinutes * 60_000);

    const customerAddress = await this.customerRepo.findWithDefaultAddress(customerId);
    const addressId = customerAddress?.address_id ?? 0;

    const cartHash = this.computeCartHash(cartItems);

    const snapshot: ConfirmedSnapshot = {
      assignments: assignments.map((a) => ({
        shopId: a.shopId,
        shopName: a.shopName,
        items: a.items,
        subtotal: a.subtotal,
      })),
      nearbyShopIds: shopIds,
    };

    const confirmationFields = {
      addressId,
      productAmount: totalAmount,
      totalAmount,
      confirmationToken: token,
      tokenExpiresAt: expiresAt,
      confirmedSnapshot: snapshot,
      cartHash,
    };

    // Reuse an already-open WhatsApp session draft for this customer (see
    // SessionService.ensureSession) instead of inserting a second
    // master_order row — the two orderId concepts must stay the same row.
    const existingDraft = await this.masterOrderRepo.findOpenSessionDraft(customer.id);
    const orderCode = existingDraft ? existingDraft.order_code : generateOrderCode();

    if (existingDraft) {
      await this.masterOrderRepo.attachConfirmation(existingDraft.id, confirmationFields);
    } else {
      await this.masterOrderRepo.createDraft({ orderCode, customerId: customer.id, ...confirmationFields });
    }

    const summary = this.buildSummaryLines(assignments);
    const shopBreakdown = this.buildBreakdown(assignments);

    this.logger.info('Order confirmation requested', {
      customerId,
      orderCode,
      shopCount: assignments.length,
      total: totalAmount,
    });

    return {
      summary,
      total: Math.round(totalAmount * 100) / 100,
      confirmationToken: token,
      expiresAt: expiresAt.toISOString(),
      shopBreakdown,
    };
  }

  /**
   * Consume the confirmation token and place the order using the
   * persisted snapshot — NOT by re-reading the live cart.
   */
  public async createOrder(
    confirmationToken: string,
    opts?: { deliveryNote?: string },
  ): Promise<CreateOrderResponse> {
    const order = await this.masterOrderRepo.findByToken(confirmationToken);

    if (!order) {
      return { error: true, reason: 'not_found' };
    }

    if (order.token_expires_at && order.token_expires_at < new Date()) {
      return { error: true, reason: 'expired' };
    }

    const cartId = await this.cartRepo.findOrCreate(order.customer_id);
    const liveCartItems = await this.cartRepo.findItems(cartId);
    const liveHash = this.computeCartHash(liveCartItems);

    if (liveHash !== order.cart_hash) {
      return { error: true, reason: 'cart_changed' };
    }

    const snapshot = order.confirmed_snapshot;
    if (!snapshot || !snapshot.assignments || snapshot.assignments.length === 0) {
      return { error: true, reason: 'not_found' };
    }

    await this.db.transaction(async (client: PoolClient) => {
      await this.masterOrderRepo.placeTx(client, order.id, opts?.deliveryNote);

      for (const assignment of snapshot.assignments) {
        const fulfillmentId = await this.fulfillmentRepo.insertTx(
          client,
          order.id,
          assignment.shopId,
          assignment.subtotal,
        );

        await this.orderItemRepo.insertBatchTx(
          client,
          assignment.items.map((item) => ({
            fulfillmentId,
            shopProductId: item.shopProductId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        );

        await this.orderEventRepo.insert(
          client,
          fulfillmentId,
          'status_accepted',
          'system',
          'Auto-accepted on order placement',
        );
      }

      await this.cartRepo.clearCartTx(client, cartId);
    });

    // TODO: POST /notify to edge service — notify customer that order is placed.
    // Deferred — see docs/agent-domain-contract.md open question 3.
    // apps/api owns this call (from inside transitionOrder), not the AI service.

    this.logger.info('Order placed', {
      orderId: order.id,
      orderCode: order.order_code,
      fulfillmentCount: snapshot.assignments.length,
    });

    return {
      orderId: String(order.id),
      status: 'placed',
      etaMinutes: defaultEtaMinutes,
    };
  }

  // -----------------------------------------------------------------------
  // Splitting algorithm
  // -----------------------------------------------------------------------

  private async splitAcrossShops(
    cartItems: CartItemDetailRow[],
    shopIds: number[],
  ): Promise<SnapshotAssignment[]> {
    const catalogIds = [...new Set(cartItems.map((i) => i.catalog_id))];
    const availability = await this.loadAvailability(catalogIds, shopIds);

    const shopNames = new Map<number, string>();
    const shops = await this.shopRepo.findAllActiveWithLocation();
    for (const shop of shops) {
      shopNames.set(shop.id, shop.name);
    }

    const unassigned = new Set(cartItems.map((_, idx) => idx));
    const assignments = new Map<number, SnapshotAssignment>();

    while (unassigned.size > 0) {
      let bestShopId = -1;
      let bestCoverage: number[] = [];

      for (const sid of shopIds) {
        const covered: number[] = [];
        for (const idx of unassigned) {
          const item = cartItems[idx];
          const options = availability.get(item.catalog_id);
          if (options?.some((o) => o.shopId === sid)) {
            covered.push(idx);
          }
        }
        if (covered.length > bestCoverage.length) {
          bestShopId = sid;
          bestCoverage = covered;
        }
      }

      if (bestShopId === -1) break;

      const assignment: SnapshotAssignment = assignments.get(bestShopId) ?? {
        shopId: bestShopId,
        shopName: shopNames.get(bestShopId) ?? 'Unknown',
        items: [],
        subtotal: 0,
      };

      for (const idx of bestCoverage) {
        const item = cartItems[idx];
        const options = availability.get(item.catalog_id) ?? [];
        const shopOption = options.find((o) => o.shopId === bestShopId);
        if (!shopOption) continue;

        assignment.items.push({
          catalogId: item.catalog_id,
          productName: item.product_name,
          quantity: item.quantity,
          unit: item.unit,
          shopProductId: shopOption.shopProductId,
          unitPrice: shopOption.unitPrice,
        });
        assignment.subtotal += shopOption.unitPrice * item.quantity;
        unassigned.delete(idx);
      }

      assignments.set(bestShopId, assignment);
    }

    return this.rebalance([...assignments.values()], availability);
  }

  private rebalance(
    assignments: SnapshotAssignment[],
    availability: Map<number, { shopId: number; shopProductId: number; unitPrice: number }[]>,
  ): SnapshotAssignment[] {
    const large: SnapshotAssignment[] = [];
    const small: SnapshotAssignment[] = [];

    for (const a of assignments) {
      if (a.subtotal >= minFulfillmentAmount) {
        large.push(a);
      } else {
        small.push(a);
      }
    }

    for (const sa of small) {
      let fullyReassigned = true;

      for (const item of sa.items) {
        const options = availability.get(item.catalogId) ?? [];
        const alt = options.find(
          (o) => o.shopId !== sa.shopId && large.some((la) => la.shopId === o.shopId),
        );

        if (alt) {
          const target = large.find((la) => la.shopId === alt.shopId)!;
          target.items.push({ ...item, shopProductId: alt.shopProductId, unitPrice: alt.unitPrice });
          target.subtotal += alt.unitPrice * item.quantity;
        } else {
          fullyReassigned = false;
        }
      }

      if (!fullyReassigned) {
        large.push(sa);
      }
    }

    return large.filter((a) => a.items.length > 0);
  }

  private async loadAvailability(
    catalogIds: number[],
    shopIds: number[],
  ): Promise<Map<number, { shopId: number; shopProductId: number; unitPrice: number }[]>> {
    if (catalogIds.length === 0 || shopIds.length === 0) return new Map();

    const result = await this.db.query<{
      catalog_id: number;
      shop_id: number;
      id: number;
      selling_price: string;
    }>(
      `SELECT catalog_id, shop_id, id, selling_price
       FROM shop_product
       WHERE catalog_id = ANY($1::int[])
         AND shop_id = ANY($2::int[])
         AND is_available = true
         AND stock_quantity > 0`,
      [catalogIds, shopIds],
    );

    const map = new Map<number, { shopId: number; shopProductId: number; unitPrice: number }[]>();
    for (const row of result.rows) {
      const list = map.get(row.catalog_id) ?? [];
      list.push({
        shopId: row.shop_id,
        shopProductId: row.id,
        unitPrice: parseFloat(row.selling_price),
      });
      map.set(row.catalog_id, list);
    }
    return map;
  }

  private computeCartHash(items: CartItemDetailRow[]): string {
    const sorted = [...items]
      .sort((a, b) => a.catalog_id - b.catalog_id)
      .map((i) => `${i.catalog_id}:${i.quantity}`);
    return createHash('sha256').update(sorted.join('|')).digest('hex').slice(0, 16);
  }

  private buildSummaryLines(assignments: SnapshotAssignment[]): DomainCartLine[] {
    const lines: DomainCartLine[] = [];
    for (const a of assignments) {
      for (const item of a.items) {
        lines.push({
          lineId: String(item.shopProductId),
          productName: item.productName,
          quantity: item.quantity,
          unit: item.unit,
          price: item.unitPrice,
        });
      }
    }
    return lines;
  }

  private buildBreakdown(assignments: SnapshotAssignment[]): ShopBreakdownEntry[] {
    return assignments.map((a) => ({
      shopId: String(a.shopId),
      shopName: a.shopName,
      items: a.items.map((item) => ({
        lineId: String(item.shopProductId),
        productName: item.productName,
        quantity: item.quantity,
        unit: item.unit,
        price: item.unitPrice,
      })),
      subtotal: Math.round(a.subtotal * 100) / 100,
    }));
  }
}

import { randomBytes } from 'crypto';
import { PoolClient } from 'pg';

import { AppError } from '../lib/app-error';
import { Database } from '../lib/db';
import { Logger } from '../logger/logger';
import { CartRepository } from '../repositories/cart.repository';
import { CustomerRepository } from '../repositories/customer.repository';
import { FulfillmentRepository } from '../repositories/fulfillment.repository';
import { MasterOrderRepository } from '../repositories/master-order.repository';
import { OrderEventRepository } from '../repositories/order-event.repository';
import { OrderItemRepository } from '../repositories/order-item.repository';
import { ShopRepository } from '../repositories/shop.repository';
import {
  OrderConfirmationResponse,
  CreateOrderResponse,
  DomainCartLine,
  ShopBreakdownEntry,
} from '../types';
import {
  confirmationTokenTtlMinutes,
  defaultEtaMinutes,
  minFulfillmentAmount,
} from '../constants';

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface CartSnapshot {
  catalogId: number;
  productName: string;
  quantity: number;
  unit: string;
}

interface ShopAssignment {
  shopId: number;
  shopName: string;
  items: (CartSnapshot & { shopProductId: number; unitPrice: number })[];
  subtotal: number;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class OrderPlacementService {
  private readonly cartRepo: CartRepository;
  private readonly customerRepo: CustomerRepository;
  private readonly shopRepo: ShopRepository;
  private readonly masterOrderRepo: MasterOrderRepository;
  private readonly fulfillmentRepo: FulfillmentRepository;
  private readonly orderItemRepo: OrderItemRepository;
  private readonly orderEventRepo: OrderEventRepository;
  private readonly db: Database;
  private readonly logger: Logger;

  constructor(deps: {
    cartRepo: CartRepository;
    customerRepo: CustomerRepository;
    shopRepo: ShopRepository;
    masterOrderRepo: MasterOrderRepository;
    fulfillmentRepo: FulfillmentRepository;
    orderItemRepo: OrderItemRepository;
    orderEventRepo: OrderEventRepository;
    db: Database;
    logger: Logger;
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
   * Snapshot the cart, run the splitting algorithm, and return a
   * confirmation token. Creates a draft master_order.
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

    const orderCode = this.generateOrderCode();

    await this.masterOrderRepo.createDraft({
      orderCode,
      customerId: customer.id,
      addressId,
      productAmount: totalAmount,
      totalAmount,
      confirmationToken: token,
      tokenExpiresAt: expiresAt,
    });

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
   * Consume the confirmation token, create fulfillments + order items,
   * and clear the cart.
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
    const cartItems = await this.cartRepo.findItems(cartId);

    if (cartItems.length === 0) {
      return { error: true, reason: 'cart_changed' };
    }

    // Re-resolve nearby shops from all active shops to re-split
    const allShops = await this.shopRepo.findAllActiveWithLocation();
    const shopIds = allShops.map((s) => s.id);

    const assignments = await this.splitAcrossShops(cartItems, shopIds);

    if (assignments.length === 0) {
      return { error: true, reason: 'cart_changed' };
    }

    await this.db.transaction(async (client: PoolClient) => {
      await this.masterOrderRepo.placeTx(client, order.id, opts?.deliveryNote);

      for (const assignment of assignments) {
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

    this.logger.info('Order placed', {
      orderId: order.id,
      orderCode: order.order_code,
      fulfillmentCount: assignments.length,
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

  /**
   * Greedy set-cover: assign cart items to shops, minimizing shop count
   * and avoiding fulfillments below the minimum amount.
   */
  private async splitAcrossShops(
    cartItems: { line_id: number; catalog_id: number; product_name: string; quantity: number; unit: string }[],
    shopIds: number[],
  ): Promise<ShopAssignment[]> {
    // Build a map: catalogId → list of { shopId, shopProductId, unitPrice }
    const catalogIds = [...new Set(cartItems.map((i) => i.catalog_id))];
    const availability = await this.loadAvailability(catalogIds, shopIds);

    const shopNames = new Map<number, string>();
    const shops = await this.shopRepo.findAllActiveWithLocation();
    for (const shop of shops) {
      shopNames.set(shop.id, shop.name);
    }

    // Track which items are unassigned
    const unassigned = new Set(cartItems.map((_, idx) => idx));
    const assignments = new Map<number, ShopAssignment>();

    // Greedy: pick the shop that covers the most unassigned items
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

      if (bestShopId === -1) break; // remaining items unavailable at any shop

      const assignment: ShopAssignment = assignments.get(bestShopId) ?? {
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

    // Rebalance: move items from small fulfillments to larger ones if possible
    return this.rebalance([...assignments.values()], availability);
  }

  /**
   * If a shop's fulfillment is below the minimum amount, try to
   * reassign its items to another shop that also carries them.
   */
  private rebalance(
    assignments: ShopAssignment[],
    availability: Map<number, { shopId: number; shopProductId: number; unitPrice: number }[]>,
  ): ShopAssignment[] {
    const large: ShopAssignment[] = [];
    const small: ShopAssignment[] = [];

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
        // Keep the small assignment — some items can only come from here
        large.push(sa);
      }
    }

    return large.filter((a) => a.items.length > 0);
  }

  /** Load shop_product availability for the given catalog items across shops. */
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

  private buildSummaryLines(assignments: ShopAssignment[]): DomainCartLine[] {
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

  private buildBreakdown(assignments: ShopAssignment[]): ShopBreakdownEntry[] {
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

  private generateOrderCode(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = randomBytes(2).toString('hex').toUpperCase();
    return `ORD-${ts}-${rand}`;
  }
}

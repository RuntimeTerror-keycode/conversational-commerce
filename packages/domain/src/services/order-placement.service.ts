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
import { ShopProductRepository } from '../repositories/shop-product.repository';
import { generateOrderCode } from '../lib/order-code';
import {
  confirmationTokenTtlMinutes,
  defaultEtaMinutes,
  additionalStoreDeliveryFee,
} from '../constants';

export class OrderPlacementService {
  private readonly cartRepo: CartRepository;
  private readonly customerRepo: CustomerRepository;
  private readonly shopRepo: ShopRepository;
  private readonly masterOrderRepo: MasterOrderRepository;
  private readonly fulfillmentRepo: FulfillmentRepository;
  private readonly orderItemRepo: OrderItemRepository;
  private readonly orderEventRepo: OrderEventRepository;
  private readonly shopProductRepo: ShopProductRepository;
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
    shopProductRepo: ShopProductRepository;
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
    this.shopProductRepo = deps.shopProductRepo;
    this.db = deps.db;
    this.logger = deps.logger.child('OrderPlacementService');
  }

  /**
   * Save a delivery address exactly as the customer typed it in chat. No
   * coordinates here — this is the model-driven path (the setDeliveryAddress
   * tool), and a customer's typed text never has real coordinates to give.
   * A genuine WhatsApp location share's coordinates are recorded separately
   * and deterministically, in code, by recordSharedLocation below — never
   * through this tool-driven path, so shop-distance routing can never
   * depend on the model faithfully copying numbers through.
   */
  public async setDeliveryAddress(customerId: string, addressLine: string): Promise<{ deliveryAddress: string }> {
    const customer = await this.customerRepo.findByPhone(customerId);
    if (!customer) throw AppError.notFound('Customer not found');

    const trimmed = addressLine.trim();
    if (trimmed.length < 3) {
      throw AppError.validation('Address is too short to be usable');
    }

    await this.customerRepo.upsertDefaultAddress(customer.id, { addressLine: trimmed });

    this.logger.info('Delivery address set', { customerId: customer.id });

    return { deliveryAddress: trimmed };
  }

  /**
   * Records a real WhatsApp location share's coordinates against the
   * customer's default address. Called directly from apps/agent's turn
   * handler before the model ever runs — not a tool, so it can't be skipped
   * or garbled by the model. This is the only path that ever writes real
   * coordinates from the live conversation, which is what makes
   * distance-based shop routing (RetailerResolveService.rankByDistance)
   * actually reflect where the customer is.
   */
  public async recordSharedLocation(
    customerId: string,
    addressLine: string,
    latitude: number,
    longitude: number,
  ): Promise<void> {
    // Runs before resolveRetailer() (so this turn's shop routing can use it
    // immediately), which is otherwise what auto-creates a new customer —
    // so this path must be able to create one too, not just find one.
    const customer = await this.customerRepo.findOrCreateByPhone(customerId);

    await this.customerRepo.upsertDefaultAddress(customer.id, {
      addressLine: addressLine.trim() || undefined,
      latitude,
      longitude,
    });

    this.logger.info('Shared location recorded', { customerId: customer.id, latitude, longitude });
  }

  /** Save the customer's chosen payment method — 'cod' or 'gpay'. */
  public async setPaymentMode(customerId: string, mode: 'cod' | 'gpay'): Promise<{ paymentMode: string }> {
    const customer = await this.customerRepo.findByPhone(customerId);
    if (!customer) throw AppError.notFound('Customer not found');

    await this.customerRepo.setDefaultPaymentMode(customer.id, mode);

    this.logger.info('Payment mode set', { customerId: customer.id, mode });

    return { paymentMode: mode };
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
    const { assignments, deliveryFee } = await this.splitAcrossShops(cartItems, shopIds);

    if (assignments.length === 0) {
      throw AppError.validation('No shops can fulfill any items in the cart');
    }

    const productAmount = assignments.reduce((sum, a) => sum + a.subtotal, 0);
    const totalAmount = productAmount + deliveryFee;
    const token = randomBytes(24).toString('hex');
    const expiresAt = new Date(Date.now() + confirmationTokenTtlMinutes * 60_000);

    const customerAddress = await this.customerRepo.findWithDefaultAddress(customerId);
    const addressId = customerAddress?.address_id ?? 0;
    const deliveryAddress = this.formatAddress(customerAddress);
    const paymentMode = customerAddress?.default_payment_mode ?? null;

    const cartHash = this.computeCartHash(cartItems);

    const snapshot: ConfirmedSnapshot = {
      assignments: assignments.map((a) => ({
        shopId: a.shopId,
        shopName: a.shopName,
        items: a.items,
        subtotal: a.subtotal,
      })),
      nearbyShopIds: shopIds,
      deliveryFee,
    };

    const confirmationFields = {
      addressId,
      paymentMode: paymentMode ?? 'cod',
      productAmount,
      totalAmount,
      deliveryFee,
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
      deliveryAddress,
      paymentMode,
      deliveryFee: Math.round(deliveryFee * 100) / 100,
    };
  }

  private formatAddress(
    address: { label: string | null; address_line: string | null; city: string | null } | null,
  ): string | null {
    if (!address) return null;
    const parts = [address.label, address.address_line, address.city].filter(
      (part): part is string => Boolean(part && part.trim()),
    );
    return parts.length > 0 ? parts.join(', ') : null;
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

        for (const item of assignment.items) {
          await this.shopProductRepo.decrementStockTx(client, item.shopProductId, item.quantity);
        }

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

    // The /notify call to apps/edge (reason: order_accepted) is NOT made here —
    // packages/domain stays free of HTTP/channel concerns. apps/api's
    // OrderController triggers it after createOrder returns, via
    // apps/api/src/services/order-notify.service.ts.

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

  /**
   * Rule 1: if any single shop — walked in nearest-first order, since
   * shopIds arrives distance-sorted from RetailerResolveService — stocks
   * every item in the cart, use it alone. One store, one delivery, no
   * delivery fee.
   *
   * Rule 2: otherwise a split is unavoidable. Brute-force every non-empty
   * subset of the shops that stock at least one cart item (cart sizes and
   * nearby-shop counts here are small, so this is cheap), keep only subsets
   * that jointly cover the whole cart, and within each subset assign every
   * item to its cheapest available shop. Compare subsets on
   * items-cost + (extra stores actually used) * additionalStoreDeliveryFee,
   * and keep the cheapest — so a split is only chosen over a cheaper
   * single-store subset when its item savings outweigh the extra delivery
   * fee, matching "best value for the customer", not just fewest stores.
   */
  private async splitAcrossShops(
    cartItems: CartItemDetailRow[],
    shopIds: number[],
  ): Promise<{ assignments: SnapshotAssignment[]; deliveryFee: number }> {
    const catalogIds = [...new Set(cartItems.map((i) => i.catalog_id))];
    const availability = await this.loadAvailability(catalogIds, shopIds);

    const shopNames = new Map<number, string>();
    const shops = await this.shopRepo.findAllActiveWithLocation();
    for (const shop of shops) {
      shopNames.set(shop.id, shop.name);
    }

    const buildSingleShopAssignment = (sid: number): SnapshotAssignment => {
      const assignment: SnapshotAssignment = {
        shopId: sid,
        shopName: shopNames.get(sid) ?? 'Unknown',
        items: [],
        subtotal: 0,
      };
      for (const item of cartItems) {
        const option = availability.get(item.catalog_id)!.find((o) => o.shopId === sid)!;
        assignment.items.push({
          catalogId: item.catalog_id,
          productName: item.product_name,
          quantity: item.quantity,
          unit: item.unit,
          shopProductId: option.shopProductId,
          unitPrice: option.unitPrice,
        });
        assignment.subtotal += option.unitPrice * item.quantity;
      }
      return assignment;
    };

    for (const sid of shopIds) {
      const coversAll = cartItems.every((item) =>
        availability.get(item.catalog_id)?.some((o) => o.shopId === sid),
      );
      if (coversAll) {
        return { assignments: [buildSingleShopAssignment(sid)], deliveryFee: 0 };
      }
    }

    const candidateShopIds = shopIds.filter((sid) =>
      cartItems.some((item) => availability.get(item.catalog_id)?.some((o) => o.shopId === sid)),
    );

    if (candidateShopIds.length === 0) {
      return { assignments: [], deliveryFee: 0 };
    }

    let best: { assignments: SnapshotAssignment[]; deliveryFee: number; totalCost: number } | null = null;
    const n = candidateShopIds.length;

    for (let mask = 1; mask < 1 << n; mask++) {
      const subset = candidateShopIds.filter((_, i) => mask & (1 << i));

      const covers = cartItems.every((item) =>
        availability.get(item.catalog_id)?.some((o) => subset.includes(o.shopId)),
      );
      if (!covers) continue;

      const assignmentMap = new Map<number, SnapshotAssignment>();
      for (const item of cartItems) {
        const options = (availability.get(item.catalog_id) ?? []).filter((o) => subset.includes(o.shopId));
        const cheapest = options.reduce((a, b) => (b.unitPrice < a.unitPrice ? b : a));

        const assignment = assignmentMap.get(cheapest.shopId) ?? {
          shopId: cheapest.shopId,
          shopName: shopNames.get(cheapest.shopId) ?? 'Unknown',
          items: [],
          subtotal: 0,
        };
        assignment.items.push({
          catalogId: item.catalog_id,
          productName: item.product_name,
          quantity: item.quantity,
          unit: item.unit,
          shopProductId: cheapest.shopProductId,
          unitPrice: cheapest.unitPrice,
        });
        assignment.subtotal += cheapest.unitPrice * item.quantity;
        assignmentMap.set(cheapest.shopId, assignment);
      }

      const assignments = [...assignmentMap.values()];
      const itemsCost = assignments.reduce((sum, a) => sum + a.subtotal, 0);
      const deliveryFee = Math.max(0, assignments.length - 1) * additionalStoreDeliveryFee;
      const totalCost = itemsCost + deliveryFee;

      if (!best || totalCost < best.totalCost) {
        best = { assignments, deliveryFee, totalCost };
      }
    }

    if (!best) {
      return { assignments: [], deliveryFee: 0 };
    }

    return { assignments: best.assignments, deliveryFee: best.deliveryFee };
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
    // shopName is deliberately a positional label, not the real supermarket
    // name — the customer must never learn which brand is fulfilling their
    // order. Fixed in code, not left to prompting, so it can't leak.
    return assignments.map((a, index) => ({
      shopId: String(a.shopId),
      shopName: `Store ${index + 1}`,
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

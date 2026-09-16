import { AppError } from '../lib/app-error';
import { Logger } from '../logger/logger';
import { CartRepository } from '../repositories/cart.repository';
import { CatalogRepository } from '../repositories/catalog.repository';
import { CustomerRepository } from '../repositories/customer.repository';
import { ShopProductRepository } from '../repositories/shop-product.repository';
import { RetailerResolveService } from './retailer-resolve.service';
import { DomainCart, DomainCartLine, CartOpInput } from '../types';

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class CartService {
  private readonly cartRepo: CartRepository;
  private readonly catalogRepo: CatalogRepository;
  private readonly customerRepo: CustomerRepository;
  private readonly shopProductRepo: ShopProductRepository;
  private readonly retailerService: RetailerResolveService;
  private readonly logger: Logger;

  constructor(
    cartRepo: CartRepository,
    catalogRepo: CatalogRepository,
    customerRepo: CustomerRepository,
    shopProductRepo: ShopProductRepository,
    retailerService: RetailerResolveService,
    logger: Logger,
  ) {
    this.cartRepo = cartRepo;
    this.catalogRepo = catalogRepo;
    this.customerRepo = customerRepo;
    this.shopProductRepo = shopProductRepo;
    this.retailerService = retailerService;
    this.logger = logger.child('CartService');
  }

  /** Read the current cart for a customer. Prices come from nearest available shop. */
  public async getCart(customerId: string): Promise<DomainCart> {
    const customer = await this.customerRepo.findByPhone(customerId);
    if (!customer) {
      throw AppError.notFound('Customer not found');
    }

    const cartId = await this.cartRepo.findOrCreate(customer.id);
    const items = await this.cartRepo.findItems(cartId);
    const nearbyShopIds = await this.retailerService.resolveNearbyShopIds(customerId);

    const lines = await this.buildCartLines(items, nearbyShopIds);
    const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

    return {
      items: lines,
      total: Math.round(total * 100) / 100,
      currency: 'INR',
    };
  }

  /** Apply an add/remove/set operation and return the full updated cart. */
  public async mutateCart(customerId: string, op: CartOpInput): Promise<DomainCart> {
    const customer = await this.customerRepo.findByPhone(customerId);
    if (!customer) {
      throw AppError.notFound('Customer not found');
    }

    const catalogId = parseInt(op.productId, 10);
    if (isNaN(catalogId)) {
      throw AppError.validation(`Invalid productId: ${op.productId}`);
    }

    const catalogExists = await this.catalogRepo.exists(catalogId);
    if (!catalogExists) {
      throw AppError.validation(`Unknown product: ${op.productId}`);
    }

    const cartId = await this.cartRepo.findOrCreate(customer.id);

    switch (op.action) {
      case 'add': {
        if (op.quantity <= 0) {
          throw AppError.validation('quantity must be positive for add');
        }
        const nearbyShopIds = await this.retailerService.resolveNearbyShopIds(customerId);
        const available = await this.catalogRepo.isAvailableAtAnyShop(catalogId, nearbyShopIds);
        if (!available) {
          throw AppError.validation('Product is not available at any nearby shop');
        }
        await this.cartRepo.addItem(cartId, catalogId, op.quantity);
        break;
      }

      case 'set': {
        if (op.quantity <= 0) {
          throw AppError.validation('quantity must be positive for set');
        }
        const existing = await this.cartRepo.findItemByCatalog(cartId, catalogId);
        if (!existing) {
          throw AppError.notFound('Product not in cart');
        }
        await this.cartRepo.setItemQuantity(cartId, catalogId, op.quantity);
        break;
      }

      case 'remove': {
        const item = await this.cartRepo.findItemByCatalog(cartId, catalogId);
        if (!item) {
          throw AppError.notFound('Product not in cart');
        }
        await this.cartRepo.removeItem(cartId, catalogId);
        break;
      }

      default:
        throw AppError.validation(`Invalid action: ${op.action}`);
    }

    await this.cartRepo.updateTimestamp(cartId);

    this.logger.info('Cart mutated', {
      customerId,
      action: op.action,
      productId: op.productId,
      quantity: op.quantity,
    });

    return this.getCart(customerId);
  }

  /**
   * Build cart lines with indicative prices from nearest available shop.
   */
  private async buildCartLines(
    items: { line_id: number; catalog_id: number; product_name: string; quantity: number; unit: string }[],
    nearbyShopIds: number[],
  ): Promise<DomainCartLine[]> {
    if (items.length === 0) return [];

    const catalogIds = items.map((i) => i.catalog_id);
    const priceMap = await this.getCheapestPrices(catalogIds, nearbyShopIds);

    return items.map((item) => ({
      lineId: String(item.line_id),
      productName: item.product_name,
      quantity: item.quantity,
      unit: item.unit,
      price: priceMap.get(item.catalog_id) ?? 0,
    }));
  }

  /** Get cheapest selling price per catalog item across the given shops. */
  private async getCheapestPrices(
    catalogIds: number[],
    shopIds: number[],
  ): Promise<Map<number, number>> {
    if (catalogIds.length === 0 || shopIds.length === 0) return new Map();

    const result = await this.shopProductRepo.cheapestPrices(catalogIds, shopIds);
    return new Map(result.map((r) => [r.catalog_id, r.price]));
  }
}

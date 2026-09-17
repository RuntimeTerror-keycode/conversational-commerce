import { AppError } from '../lib/app-error';
import { ILogger, DomainCart, DomainCartLine, CartOpInput } from '../types';
import { CartRepository } from '../repositories/cart.repository';
import { CatalogRepository } from '../repositories/catalog.repository';
import { CustomerRepository } from '../repositories/customer.repository';
import { ShopProductRepository } from '../repositories/shop-product.repository';

export class CartService {
  private readonly cartRepo: CartRepository;
  private readonly catalogRepo: CatalogRepository;
  private readonly customerRepo: CustomerRepository;
  private readonly shopProductRepo: ShopProductRepository;
  private readonly logger: ILogger;

  constructor(
    cartRepo: CartRepository,
    catalogRepo: CatalogRepository,
    customerRepo: CustomerRepository,
    shopProductRepo: ShopProductRepository,
    logger: ILogger,
  ) {
    this.cartRepo = cartRepo;
    this.catalogRepo = catalogRepo;
    this.customerRepo = customerRepo;
    this.shopProductRepo = shopProductRepo;
    this.logger = logger.child('CartService');
  }

  /** retailerId is the scoping boundary — cart pricing is always against a single shop. */
  public async getCart(retailerId: string, customerId: string): Promise<DomainCart> {
    const shopId = parseInt(retailerId, 10);
    if (isNaN(shopId)) {
      throw AppError.validation('retailerId must be a valid number');
    }

    const customer = await this.customerRepo.findByPhone(customerId);
    if (!customer) {
      throw AppError.notFound('Customer not found');
    }

    const cartId = await this.cartRepo.findOrCreate(customer.id);
    const items = await this.cartRepo.findItems(cartId);

    const lines = await this.buildCartLines(items, [shopId]);
    const total = lines.reduce((sum, line) => sum + line.price * line.quantity, 0);

    return {
      items: lines,
      total: Math.round(total * 100) / 100,
      currency: 'INR',
      priceNote: 'Prices are indicative (cheapest nearby). Final price confirmed at checkout.',
    };
  }

  public async mutateCart(retailerId: string, customerId: string, op: CartOpInput): Promise<DomainCart> {
    const shopId = parseInt(retailerId, 10);
    if (isNaN(shopId)) {
      throw AppError.validation('retailerId must be a valid number');
    }

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
        const available = await this.catalogRepo.isAvailableAtAnyShop(catalogId, [shopId]);
        if (!available) {
          throw AppError.validation('Product is not available at this shop');
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
      retailerId,
      customerId,
      action: op.action,
      productId: op.productId,
      quantity: op.quantity,
    });

    return this.getCart(retailerId, customerId);
  }

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

  private async getCheapestPrices(
    catalogIds: number[],
    shopIds: number[],
  ): Promise<Map<number, number>> {
    if (catalogIds.length === 0 || shopIds.length === 0) return new Map();

    const result = await this.shopProductRepo.cheapestPrices(catalogIds, shopIds);
    return new Map(result.map((r) => [r.catalog_id, r.price]));
  }
}

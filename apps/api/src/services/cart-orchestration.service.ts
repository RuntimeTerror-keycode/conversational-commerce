import { CartService, RetailerResolveService, DomainCart, CartOpInput } from '@cc/domain';

/**
 * Thin orchestration layer for the customerId-addressed cart routes —
 * resolves retailerId from customerId, then delegates to the retailerId-first
 * @cc/domain service. Keeps CartController down to one dependency/call,
 * per apps/api/CONVENTIONS.md, without reintroducing retailer resolution
 * inside the domain service itself.
 */
export class CartOrchestrationService {
  private readonly cartService: CartService;
  private readonly retailerService: RetailerResolveService;

  constructor(cartService: CartService, retailerService: RetailerResolveService) {
    this.cartService = cartService;
    this.retailerService = retailerService;
  }

  public async getCartByCustomer(customerId: string): Promise<DomainCart> {
    const { primary } = await this.retailerService.resolve(customerId);
    return this.cartService.getCart(primary.retailerId, customerId);
  }

  public async mutateCartByCustomer(customerId: string, op: CartOpInput): Promise<DomainCart> {
    const { primary } = await this.retailerService.resolve(customerId);
    return this.cartService.mutateCart(primary.retailerId, customerId, op);
  }
}

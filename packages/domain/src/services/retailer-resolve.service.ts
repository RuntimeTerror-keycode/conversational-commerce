import { AppError } from '../lib/app-error';
import { haversineKm } from '../lib/geo';
import { isWithinOpeningHours } from '../lib/shop-hours';
import { ILogger, ShopWithLocationRow, ResolveRetailerResponse, NearbyShop } from '../types';
import { CustomerRepository } from '../repositories/customer.repository';
import { ShopRepository } from '../repositories/shop.repository';

export class RetailerResolveService {
  private readonly customerRepo: CustomerRepository;
  private readonly shopRepo: ShopRepository;
  private readonly logger: ILogger;

  constructor(
    customerRepo: CustomerRepository,
    shopRepo: ShopRepository,
    logger: ILogger,
  ) {
    this.customerRepo = customerRepo;
    this.shopRepo = shopRepo;
    this.logger = logger.child('RetailerResolveService');
  }

  public async resolve(customerRef: string): Promise<ResolveRetailerResponse> {
    const customer = await this.getOrCreateCustomer(customerRef);

    const shops = await this.shopRepo.findAllActiveWithLocation();

    if (shops.length === 0) {
      throw AppError.notFound('No active shops available');
    }

    // Enforced here, not left to the model: a shop outside its opening hours
    // must not be searchable, addable to cart, or orderable, no matter what
    // the customer says. Checked fresh every turn, so it flips the moment
    // opening_time/closing_time says so.
    const openShops = shops.filter((s) => isWithinOpeningHours(s.opening_time, s.closing_time));

    if (openShops.length === 0) {
      throw AppError.validation('All nearby shops are closed right now', {
        nextOpeningTime: this.earliestOpeningTime(shops),
      });
    }

    const nearby = this.rankByDistance(customer.latitude, customer.longitude, openShops);

    if (nearby.length === 0) {
      throw AppError.notFound('No shops within delivery range');
    }

    const primaryShop = openShops.find((s) => s.id === parseInt(nearby[0].retailerId, 10))!;

    this.logger.info('Retailer resolved', {
      customerRef,
      primaryShop: nearby[0].retailerId,
      nearbyCount: nearby.length,
    });

    return {
      primary: {
        retailerId: String(primaryShop.id),
        name: primaryShop.name,
        area: primaryShop.city ?? 'Unknown',
      },
      nearby,
      deliveryAddress: this.formatAddress(customer),
      paymentMode: customer.default_payment_mode,
      hasLocation: customer.latitude !== null && customer.longitude !== null,
    };
  }

  private formatAddress(
    address: { label: string | null; address_line: string | null; city: string | null },
  ): string | null {
    const parts = [address.label, address.address_line, address.city].filter(
      (part): part is string => Boolean(part && part.trim()),
    );
    return parts.length > 0 ? parts.join(', ') : null;
  }

  public async resolveNearbyShopIds(customerPhone: string): Promise<number[]> {
    const customer = await this.getOrCreateCustomer(customerPhone);

    const shops = await this.shopRepo.findAllActiveWithLocation();
    const openShops = shops.filter((s) => isWithinOpeningHours(s.opening_time, s.closing_time));
    const nearby = this.rankByDistance(customer.latitude, customer.longitude, openShops);
    return nearby.map((s) => parseInt(s.retailerId, 10));
  }

  /**
   * WhatsApp senders are not pre-registered — the first message from a brand
   * new phone number must still resolve a retailer. Create the customer row
   * on first contact instead of 404ing; they simply have no address yet
   * (handled downstream: requestOrderConfirmation surfaces a null
   * deliveryAddress and the agent asks for one before placing an order).
   */
  private async getOrCreateCustomer(customerRef: string) {
    const existing = await this.customerRepo.findWithDefaultAddress(customerRef);
    if (existing) return existing;

    await this.customerRepo.findOrCreateByPhone(customerRef);
    const created = await this.customerRepo.findWithDefaultAddress(customerRef);
    if (!created) {
      throw AppError.notFound('Customer not found');
    }
    return created;
  }

  /** The soonest a nearby shop reopens, "HH:MM", for the closed-store message. Null if any shop has no set hours. */
  private earliestOpeningTime(shops: ShopWithLocationRow[]): string | null {
    const times = shops.map((s) => s.opening_time).filter((t): t is string => t !== null);
    if (times.length !== shops.length || times.length === 0) return null;

    const toMinutes = (value: string): number => {
      const [h, m] = value.split(':').map(Number);
      return h * 60 + m;
    };

    return times.reduce((earliest, t) => (toMinutes(t) < toMinutes(earliest) ? t : earliest));
  }

  private rankByDistance(
    custLat: number | null,
    custLng: number | null,
    shops: ShopWithLocationRow[],
  ): NearbyShop[] {
    const results: NearbyShop[] = [];

    for (const shop of shops) {
      if (custLat === null || custLng === null || shop.latitude === null || shop.longitude === null) {
        results.push({
          retailerId: String(shop.id),
          name: shop.name,
          distanceKm: 0,
        });
        continue;
      }

      const dist = haversineKm(custLat, custLng, shop.latitude, shop.longitude);
      const radius = shop.delivery_radius_km ?? 10;

      if (dist <= radius) {
        results.push({
          retailerId: String(shop.id),
          name: shop.name,
          distanceKm: Math.round(dist * 10) / 10,
        });
      }
    }

    results.sort((a, b) => a.distanceKm - b.distanceKm);
    return results;
  }
}

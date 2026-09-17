import { AppError } from '../lib/app-error';
import { haversineKm } from '../lib/geo';
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
    const customer = await this.customerRepo.findWithDefaultAddress(customerRef);
    if (!customer) {
      throw AppError.notFound('Customer not found');
    }

    const shops = await this.shopRepo.findAllActiveWithLocation();

    if (shops.length === 0) {
      throw AppError.notFound('No active shops available');
    }

    const nearby = this.rankByDistance(customer.latitude, customer.longitude, shops);

    if (nearby.length === 0) {
      throw AppError.notFound('No shops within delivery range');
    }

    const primaryShop = shops.find((s) => s.id === parseInt(nearby[0].retailerId, 10))!;

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
    };
  }

  public async resolveNearbyShopIds(customerPhone: string): Promise<number[]> {
    const customer = await this.customerRepo.findWithDefaultAddress(customerPhone);
    if (!customer) {
      throw AppError.notFound('Customer not found');
    }

    const shops = await this.shopRepo.findAllActiveWithLocation();
    const nearby = this.rankByDistance(customer.latitude, customer.longitude, shops);
    return nearby.map((s) => parseInt(s.retailerId, 10));
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

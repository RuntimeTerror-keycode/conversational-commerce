import { CatalogSearchService, RetailerResolveService, DomainProduct, AvailabilityResult } from '@cc/domain';

/**
 * Thin orchestration layer for the customerId-addressed catalog routes —
 * resolves retailerId from customerId, then delegates to the retailerId-first
 * @cc/domain service. Keeps CatalogController down to one dependency/call,
 * per apps/api/CONVENTIONS.md, without reintroducing retailer resolution
 * inside the domain service itself.
 */
export class CatalogOrchestrationService {
  private readonly catalogSearchService: CatalogSearchService;
  private readonly retailerService: RetailerResolveService;

  constructor(catalogSearchService: CatalogSearchService, retailerService: RetailerResolveService) {
    this.catalogSearchService = catalogSearchService;
    this.retailerService = retailerService;
  }

  public async searchByCustomer(
    customerId: string,
    query: string,
    opts?: { attributes?: Record<string, string>; limit?: number },
  ): Promise<DomainProduct[]> {
    const { primary } = await this.retailerService.resolve(customerId);
    return this.catalogSearchService.searchProducts(primary.retailerId, query, opts);
  }

  public async checkAvailability(retailerId: string, productIds: string[]): Promise<AvailabilityResult[]> {
    return this.catalogSearchService.checkAvailability(retailerId, productIds);
  }
}

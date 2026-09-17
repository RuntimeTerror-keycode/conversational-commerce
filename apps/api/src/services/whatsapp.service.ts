import {
  AppError,
  CartService,
  CatalogSearchService,
  RetailerResolveService,
  SessionService,
  classifyMatches,
  formatIndianPrice,
} from '@cc/domain';
import { Logger } from '../logger/logger';
import {
  WhatsappRow,
  WhatsappSearchRequest,
  WhatsappSearchResponse,
  WhatsappSelectRequest,
  WhatsappSelectResponse,
} from '../types';

export class WhatsappService {
  private readonly sessionService: SessionService;
  private readonly retailerService: RetailerResolveService;
  private readonly catalogService: CatalogSearchService;
  private readonly cartService: CartService;
  private readonly logger: Logger;

  constructor(
    sessionService: SessionService,
    retailerService: RetailerResolveService,
    catalogService: CatalogSearchService,
    cartService: CartService,
    logger: Logger,
  ) {
    this.sessionService = sessionService;
    this.retailerService = retailerService;
    this.catalogService = catalogService;
    this.cartService = cartService;
    this.logger = logger.child('WhatsappService');
  }

  public async search(req: WhatsappSearchRequest): Promise<WhatsappSearchResponse> {
    const session = await this.sessionService.ensureSession(req.customerRef, {
      addressLine: req.address.addressLine,
      latitude: req.address.latitude,
      longitude: req.address.longitude,
      paymentMode: req.paymentMode,
    });
    await this.sessionService.logInboundMessage(session.customerId, req.messageId, req.text);

    const { primary } = await this.retailerService.resolve(req.customerRef);
    const products = await this.catalogService.searchProducts(primary.retailerId, req.text, { limit: 3 });

    this.logger.info('WhatsApp search', {
      customerRef: req.customerRef,
      orderId: session.orderId,
      retailerId: primary.retailerId,
      resultCount: products.length,
    });

    const toRow = (p: (typeof products)[number]): WhatsappRow => ({
      id: Number(p.id),
      title: p.name,
      description: p.brand ?? undefined,
      price: formatIndianPrice(p.price),
    });

    const match = classifyMatches(products);

    switch (match.kind) {
      case 'none':
        return {
          customerRef: req.customerRef,
          orderId: session.orderId,
          tag: 'not_found',
          body: `Sorry, we couldn't find that at the store.`,
        };
      case 'single':
        return { customerRef: req.customerRef, orderId: session.orderId, tag: 'found', rows: [toRow(match.item)] };
      case 'multiple':
        return {
          customerRef: req.customerRef,
          orderId: session.orderId,
          tag: 'choice',
          body: `Found a few options for "${req.text}" — which one?`,
          rows: match.items.map(toRow),
        };
    }
  }

  public async select(req: WhatsappSelectRequest): Promise<WhatsappSelectResponse> {
    const owned = await this.sessionService.findDraftForCustomer(req.customerRef, req.orderId);
    if (!owned) {
      throw AppError.notFound('Unknown order for this customer');
    }

    const { primary } = await this.retailerService.resolve(req.customerRef);
    const [availability] = await this.catalogService.checkAvailability(primary.retailerId, [String(req.productId)]);

    if (!availability.inStock) {
      return {
        customerRef: req.customerRef,
        orderId: req.orderId,
        tag: 'unavailable',
        body: `That item just went out of stock at the store.`,
        substitutes: availability.substitutes.map((s) => ({
          id: Number(s.id),
          name: s.name,
          unit: s.unit,
          price: s.price,
        })),
      };
    }

    const cart = await this.cartService.mutateCart(primary.retailerId, req.customerRef, {
      action: 'add',
      productId: String(req.productId),
      quantity: 1,
      unit: 'unit',
    });

    return { customerRef: req.customerRef, orderId: req.orderId, tag: 'added', cart };
  }
}

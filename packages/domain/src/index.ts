// Types (DI contracts, DB rows, domain API shapes)
export * from './types';

// Lib
export { AppError, ErrorCode } from './lib/app-error';
export { haversineKm } from './lib/geo';
export { generateOrderCode } from './lib/order-code';

// Constants
export * from './constants';

// Repositories
export { CustomerRepository } from './repositories/customer.repository';
export { ShopRepository } from './repositories/shop.repository';
export { CatalogRepository } from './repositories/catalog.repository';
export { CartRepository } from './repositories/cart.repository';
export { MasterOrderRepository } from './repositories/master-order.repository';
export { ShopProductRepository } from './repositories/shop-product.repository';
export { FulfillmentRepository } from './repositories/fulfillment.repository';
export { OrderItemRepository } from './repositories/order-item.repository';
export { OrderEventRepository } from './repositories/order-event.repository';
export { ShopUserRepository } from './repositories/shop-user.repository';
export { MessageRepository } from './repositories/message.repository';

// Services
export { RetailerResolveService } from './services/retailer-resolve.service';
export { CatalogSearchService } from './services/catalog-search.service';
export { CartService } from './services/cart.service';
export { OrderPlacementService } from './services/order-placement.service';
export { SessionService, EnsureSessionInput, SessionResult } from './services/session.service';

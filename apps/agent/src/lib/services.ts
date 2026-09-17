import {
  CartRepository,
  CartService,
  CatalogRepository,
  CatalogSearchService,
  CustomerRepository,
  FulfillmentRepository,
  MasterOrderRepository,
  OrderEventRepository,
  OrderItemRepository,
  OrderPlacementService,
  RetailerResolveService,
  ShopProductRepository,
  ShopRepository,
} from "@cc/domain";
import { Database } from "./db.js";
import { logger } from "./logger.js";

/**
 * Single wiring point for @cc/domain. Built lazily so importing a tool module
 * (in tests, or for its schema) doesn't open a pool.
 */
let services: Services | undefined;

export type Services = {
  retailer: RetailerResolveService;
  catalog: CatalogSearchService;
  cart: CartService;
  orders: OrderPlacementService;
};

function build(): Services {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set — the agent cannot reach packages/domain without it.");
  }

  const db = new Database(connectionString, logger);

  const customerRepo = new CustomerRepository(db);
  const shopRepo = new ShopRepository(db);
  const catalogRepo = new CatalogRepository(db);
  const cartRepo = new CartRepository(db);
  const masterOrderRepo = new MasterOrderRepository(db);
  const shopProductRepo = new ShopProductRepository(db);
  const fulfillmentRepo = new FulfillmentRepository(db);
  const orderItemRepo = new OrderItemRepository(db);
  const orderEventRepo = new OrderEventRepository(db);

  const retailer = new RetailerResolveService(customerRepo, shopRepo, logger);
  const catalog = new CatalogSearchService(catalogRepo, logger);
  const cart = new CartService(cartRepo, catalogRepo, customerRepo, shopProductRepo, logger);
  const orders = new OrderPlacementService({
    cartRepo,
    customerRepo,
    shopRepo,
    masterOrderRepo,
    fulfillmentRepo,
    orderItemRepo,
    orderEventRepo,
    db,
    logger,
  });

  return { retailer, catalog, cart, orders };
}

export function getServices(): Services {
  services ??= build();
  return services;
}

/** Tests inject fakes through this instead of standing up Postgres. */
export function setServices(override: Services | undefined): void {
  services = override;
}

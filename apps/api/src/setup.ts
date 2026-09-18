import { Config } from './config/config';
import { Logger } from './logger/logger';
import { Database } from './lib/db';
import { MessageBroker } from './lib/rabbitmq';

// Repositories — all from domain
import {
  ShopUserRepository,
  FulfillmentRepository,
  OrderItemRepository,
  OrderEventRepository,
  ShopProductRepository,
  StatsRepository,
  CustomerRepository,
  ShopRepository,
  CategoryRepository,
  CatalogRepository,
  CartRepository,
  MasterOrderRepository,
  MessageRepository,
} from '@cc/domain';

// Dashboard services — stay in apps/api
import { IdentifyService } from './services/identify.service';
import { FulfillmentService } from './services/fulfillment.service';
import { InventoryService } from './services/inventory.service';
import { ShopService } from './services/shop.service';
import { StatsService } from './services/stats.service';

// Domain services — from domain
import {
  RetailerResolveService,
  CatalogSearchService,
  CartService,
  OrderPlacementService,
  SessionService,
} from '@cc/domain';

// Orchestration — stays in apps/api (schema/routing only, calls @cc/domain)
import { WhatsappService } from './services/whatsapp.service';
import { CatalogOrchestrationService } from './services/catalog-orchestration.service';
import { CartOrchestrationService } from './services/cart-orchestration.service';
import { EdgeNotifyClient } from './lib/edge-notify-client';
import { NotifyService } from './services/notify.service';
import { OrderNotifyService } from './services/order-notify.service';
import { InventorySyncService } from './services/inventory-sync.service';

// Controllers
import { HealthController } from './controllers/health.controller';
import { IdentifyController } from './controllers/identify.controller';
import { FulfillmentController } from './controllers/fulfillment.controller';
import { InventoryController } from './controllers/inventory.controller';
import { RetailerController } from './controllers/retailer.controller';
import { CatalogController } from './controllers/catalog.controller';
import { CartController } from './controllers/cart.controller';
import { OrderController } from './controllers/order.controller';
import { WhatsappController } from './controllers/whatsapp.controller';
import { InventorySyncController } from './controllers/inventory-sync.controller';
import { ShopController } from './controllers/shop.controller';
import { StatsController } from './controllers/stats.controller';

// Middlewares
import { RequestLogger } from './middlewares/request-logger.middleware';
import { CorsMiddleware } from './middlewares/cors.middleware';
import { ShopContextMiddleware } from './middlewares/shop-context.middleware';
import { ServiceAuthMiddleware } from './middlewares/service-auth.middleware';
import { NotFoundHandler } from './middlewares/not-found.middleware';
import { ErrorHandler } from './middlewares/error-handler.middleware';

export interface AppControllers {
  health: HealthController;
  identify: IdentifyController;
  fulfillment: FulfillmentController;
  inventory: InventoryController;
  retailer: RetailerController;
  catalog: CatalogController;
  cart: CartController;
  order: OrderController;
  whatsapp: WhatsappController;
  inventorySync: InventorySyncController;
  shop: ShopController;
  stats: StatsController;
}

export interface AppMiddlewares {
  cors: CorsMiddleware;
  requestLogger: RequestLogger;
  shopContext: ShopContextMiddleware;
  serviceAuth: ServiceAuthMiddleware;
  notFound: NotFoundHandler;
  error: ErrorHandler;
}

export interface AppDependencies {
  config: Config;
  logger: Logger;
  db: Database;
  broker: MessageBroker;
  controllers: AppControllers;
  middlewares: AppMiddlewares;
}

export class Setup {
  public static createDependencies(): AppDependencies {
    const config = Config.getInstance();
    const logger = new Logger(config, 'App');
    const db = new Database(config.values.databaseUrl, logger);
    const broker = new MessageBroker(config.values.rabbitmqUrl, logger);

    // Repositories (all from @cc/domain, take IDatabase)
    const shopUserRepo = new ShopUserRepository(db);
    const fulfillmentRepo = new FulfillmentRepository(db);
    const orderItemRepo = new OrderItemRepository(db);
    const orderEventRepo = new OrderEventRepository(db);
    const shopProductRepo = new ShopProductRepository(db);
    const customerRepo = new CustomerRepository(db);
    const shopRepo = new ShopRepository(db);
    const statsRepo = new StatsRepository(db);
    const categoryRepo = new CategoryRepository(db);
    const catalogRepo = new CatalogRepository(db);
    const cartRepo = new CartRepository(db);
    const masterOrderRepo = new MasterOrderRepository(db);
    const messageRepo = new MessageRepository(db);

    // Notify (apps/api -> apps/edge POST /notify, docs/contracts.md §A2)
    const edgeNotifyClient = new EdgeNotifyClient(config, logger);
    const notifyService = new NotifyService(edgeNotifyClient);
    const orderNotifyService = new OrderNotifyService(masterOrderRepo, customerRepo, notifyService, logger);

    // Dashboard services
    const identifyService = new IdentifyService(shopUserRepo, logger);
    const fulfillmentService = new FulfillmentService(
      fulfillmentRepo, orderItemRepo, orderEventRepo, shopProductRepo, masterOrderRepo, db, notifyService, logger,
    );
    const inventoryService = new InventoryService(shopProductRepo, shopRepo, logger);
    const shopService = new ShopService(shopRepo, logger);
    const statsService = new StatsService(statsRepo, shopProductRepo, logger);

    // Agent-facing services (from @cc/domain, take ILogger)
    const retailerService = new RetailerResolveService(customerRepo, shopRepo, logger);
    const catalogService = new CatalogSearchService(catalogRepo, logger);
    const cartService = new CartService(
      cartRepo, catalogRepo, customerRepo, shopProductRepo, logger,
    );
    const orderPlacementService = new OrderPlacementService({
      cartRepo,
      customerRepo,
      shopRepo,
      masterOrderRepo,
      fulfillmentRepo,
      orderItemRepo,
      orderEventRepo,
      shopProductRepo,
      db,
      logger,
    });
    const sessionService = new SessionService(customerRepo, masterOrderRepo, messageRepo, logger);

    // Inventory sync (external POS webhook → RabbitMQ → DB)
    const inventorySyncService = new InventorySyncService(
      broker, db, categoryRepo, catalogRepo, shopProductRepo, shopRepo, logger,
    );

    // WhatsApp orchestration
    const whatsappService = new WhatsappService(
      sessionService, retailerService, catalogService, cartService, logger,
    );

    // Customer-facing catalog/cart orchestration (resolves retailerId from customerId)
    const catalogOrchestrationService = new CatalogOrchestrationService(catalogService, retailerService);
    const cartOrchestrationService = new CartOrchestrationService(cartService, retailerService);

    return {
      config,
      logger,
      db,
      broker,
      controllers: {
        health: new HealthController(),
        identify: new IdentifyController(identifyService),
        fulfillment: new FulfillmentController(fulfillmentService),
        inventory: new InventoryController(inventoryService),
        retailer: new RetailerController(retailerService),
        catalog: new CatalogController(catalogOrchestrationService),
        cart: new CartController(cartOrchestrationService),
        order: new OrderController(orderPlacementService, orderNotifyService),
        whatsapp: new WhatsappController(whatsappService),
        inventorySync: new InventorySyncController(inventorySyncService),
        shop: new ShopController(shopService),
        stats: new StatsController(statsService),
      },
      middlewares: {
        cors: new CorsMiddleware(),
        requestLogger: new RequestLogger(logger),
        shopContext: new ShopContextMiddleware(db, logger),
        serviceAuth: new ServiceAuthMiddleware(config),
        notFound: new NotFoundHandler(logger),
        error: new ErrorHandler(config, logger),
      },
    };
  }
}

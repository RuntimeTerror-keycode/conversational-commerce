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
  CustomerRepository,
  ShopRepository,
  CatalogRepository,
  CartRepository,
  MasterOrderRepository,
  MessageRepository,
} from '@cc/domain';

// Dashboard services — stay in apps/api
import { IdentifyService } from './services/identify.service';
import { FulfillmentService } from './services/fulfillment.service';
import { InventoryService } from './services/inventory.service';

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
    const catalogRepo = new CatalogRepository(db);
    const cartRepo = new CartRepository(db);
    const masterOrderRepo = new MasterOrderRepository(db);
    const messageRepo = new MessageRepository(db);

    // Dashboard services
    const identifyService = new IdentifyService(shopUserRepo, logger);
    const fulfillmentService = new FulfillmentService(
      fulfillmentRepo, orderItemRepo, orderEventRepo, shopProductRepo, db, logger,
    );
    const inventoryService = new InventoryService(shopProductRepo, logger);

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
      db,
      logger,
    });
    const sessionService = new SessionService(customerRepo, masterOrderRepo, messageRepo, logger);

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
        order: new OrderController(orderPlacementService),
        whatsapp: new WhatsappController(whatsappService),
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

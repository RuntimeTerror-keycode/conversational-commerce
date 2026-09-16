import { Config } from './config/config';
import { Logger } from './logger/logger';
import { Database } from './lib/db';
import { MessageBroker } from './lib/rabbitmq';

import { ShopUserRepository } from './repositories/shop-user.repository';
import { FulfillmentRepository } from './repositories/fulfillment.repository';
import { OrderItemRepository } from './repositories/order-item.repository';
import { OrderEventRepository } from './repositories/order-event.repository';
import { ShopProductRepository } from './repositories/shop-product.repository';

import { IdentifyService } from './services/identify.service';
import { FulfillmentService } from './services/fulfillment.service';
import { InventoryService } from './services/inventory.service';

import { HealthController } from './controllers/health.controller';
import { IdentifyController } from './controllers/identify.controller';
import { FulfillmentController } from './controllers/fulfillment.controller';
import { InventoryController } from './controllers/inventory.controller';

import { RequestLogger } from './middlewares/request-logger.middleware';
import { CorsMiddleware } from './middlewares/cors.middleware';
import { ShopContextMiddleware } from './middlewares/shop-context.middleware';
import { NotFoundHandler } from './middlewares/not-found.middleware';
import { ErrorHandler } from './middlewares/error-handler.middleware';

export interface AppControllers {
  health: HealthController;
  identify: IdentifyController;
  fulfillment: FulfillmentController;
  inventory: InventoryController;
}

export interface AppMiddlewares {
  cors: CorsMiddleware;
  requestLogger: RequestLogger;
  shopContext: ShopContextMiddleware;
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

    // Repositories (one per table)
    const shopUserRepo = new ShopUserRepository(db);
    const fulfillmentRepo = new FulfillmentRepository(db);
    const orderItemRepo = new OrderItemRepository(db);
    const orderEventRepo = new OrderEventRepository(db);
    const shopProductRepo = new ShopProductRepository(db);

    // Services
    const identifyService = new IdentifyService(shopUserRepo, logger);
    const fulfillmentService = new FulfillmentService(
      fulfillmentRepo, orderItemRepo, orderEventRepo, shopProductRepo, db, logger,
    );
    const inventoryService = new InventoryService(shopProductRepo, logger);

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
      },
      middlewares: {
        cors: new CorsMiddleware(),
        requestLogger: new RequestLogger(logger),
        shopContext: new ShopContextMiddleware(db, logger),
        notFound: new NotFoundHandler(logger),
        error: new ErrorHandler(config, logger),
      },
    };
  }
}

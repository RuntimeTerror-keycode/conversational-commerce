import { Config } from './config/config';
import { Logger } from './logger/logger';
import { Database } from './lib/db';
import { MessageBroker } from './lib/rabbitmq';
import { HealthController } from './controllers/health.controller';
import { RequestLogger } from './middlewares/request-logger.middleware';
import { NotFoundHandler } from './middlewares/not-found.middleware';
import { ErrorHandler } from './middlewares/error-handler.middleware';

export interface AppControllers {
  health: HealthController;
}

export interface AppMiddlewares {
  requestLogger: RequestLogger;
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

    return {
      config,
      logger,
      db,
      broker,
      controllers: {
        health: new HealthController(),
      },
      middlewares: {
        requestLogger: new RequestLogger(logger),
        notFound: new NotFoundHandler(logger),
        error: new ErrorHandler(config, logger),
      },
    };
  }
}

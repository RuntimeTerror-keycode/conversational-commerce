import { Config } from './config/config';
import { Logger } from './logger/logger';
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
  controllers: AppControllers;
  middlewares: AppMiddlewares;
}

export class Setup {
  public static createDependencies(): AppDependencies {
    const config = Config.getInstance();
    const logger = new Logger(config, 'App');

    return {
      config,
      logger,
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

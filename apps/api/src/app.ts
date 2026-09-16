import express, { Application } from 'express';
import { AppDependencies } from './setup';
import { RouteRegistrar } from './routes';

export class App {
  public readonly express: Application;
  private readonly deps: AppDependencies;

  constructor(deps: AppDependencies) {
    this.deps = deps;
    this.express = express();

    this.initializeMiddlewares();
    this.initializeRoutes();
    this.initializeErrorHandling();
  }

  public listen(): void {
    const { port, nodeEnv } = this.deps.config.values;

    this.express.listen(port, () => {
      this.deps.logger.info(`Running in ${nodeEnv} mode`);
      this.deps.logger.info(`Listening on port ${port}`);
    });
  }

  private initializeMiddlewares(): void {
    this.express.use(this.deps.middlewares.cors.handle);
    this.express.use(express.json());
    this.express.use(express.urlencoded({ extended: true }));
    this.express.use(this.deps.middlewares.requestLogger.handle);
  }

  private initializeRoutes(): void {
    const registrar = new RouteRegistrar(
      this.express,
      this.deps.controllers,
      this.deps.middlewares,
    );
    registrar.register();
  }

  private initializeErrorHandling(): void {
    this.express.use(this.deps.middlewares.notFound.handle);
    this.express.use(this.deps.middlewares.error.handle);
  }
}

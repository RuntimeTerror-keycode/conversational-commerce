import { Application } from 'express';
import { HealthController } from '../controllers/health.controller';
import { HealthRoute } from './health.route';

export class RouteRegistrar {
  private readonly app: Application;
  private readonly healthController: HealthController;

  constructor(app: Application, healthController: HealthController) {
    this.app = app;
    this.healthController = healthController;
  }

  public register(): void {
    const healthRoute = new HealthRoute(this.healthController);

    this.app.use('/api', healthRoute.router);
  }
}

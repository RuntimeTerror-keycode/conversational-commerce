import { Router } from 'express';
import { HealthController } from '../controllers/health.controller';

export class HealthRoute {
  public readonly router: Router;

  constructor(controller: HealthController) {
    this.router = Router();
    this.initializeRoutes(controller);
  }

  private initializeRoutes(controller: HealthController): void {
    this.router.get('/health', controller.check);
  }
}

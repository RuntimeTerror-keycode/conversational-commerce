import { Router } from 'express';
import { RetailerController } from '../controllers/retailer.controller';

export class RetailerRoute {
  public readonly router: Router;

  constructor(controller: RetailerController) {
    this.router = Router();
    this.initializeRoutes(controller);
  }

  private initializeRoutes(controller: RetailerController): void {
    this.router.get('/retailers/nearby', controller.nearby);
  }
}

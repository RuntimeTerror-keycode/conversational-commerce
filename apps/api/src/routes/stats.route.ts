import { Router } from 'express';
import { StatsController } from '../controllers/stats.controller';
import { ShopContextMiddleware } from '../middlewares/shop-context.middleware';

export class StatsRoute {
  public readonly router: Router;

  constructor(controller: StatsController, shopContext: ShopContextMiddleware) {
    this.router = Router();
    this.router.use(shopContext.handle);
    this.initializeRoutes(controller);
  }

  private initializeRoutes(controller: StatsController): void {
    this.router.get('/stats/today', controller.today);
  }
}

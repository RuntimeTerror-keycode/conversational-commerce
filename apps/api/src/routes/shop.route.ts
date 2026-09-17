import { Router } from 'express';
import { ShopController } from '../controllers/shop.controller';
import { ShopContextMiddleware } from '../middlewares/shop-context.middleware';

export class ShopRoute {
  public readonly router: Router;

  constructor(controller: ShopController, shopContext: ShopContextMiddleware) {
    this.router = Router();
    this.router.use(shopContext.handle);
    this.initializeRoutes(controller);
  }

  private initializeRoutes(controller: ShopController): void {
    this.router.get('/shops/me', controller.get);
    this.router.patch('/shops/me', controller.update);
  }
}

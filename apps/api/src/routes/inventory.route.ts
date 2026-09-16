import { Router } from 'express';
import { InventoryController } from '../controllers/inventory.controller';
import { ShopContextMiddleware } from '../middlewares/shop-context.middleware';

export class InventoryRoute {
  public readonly router: Router;

  constructor(controller: InventoryController, shopContext: ShopContextMiddleware) {
    this.router = Router();
    this.router.use(shopContext.handle);
    this.initializeRoutes(controller);
  }

  private initializeRoutes(controller: InventoryController): void {
    this.router.get('/inventory', controller.list);
    this.router.patch('/inventory/:id', controller.update);
  }
}

import { Router } from 'express';
import { InventoryController } from '../controllers/inventory.controller';
import { ShopContextMiddleware } from '../middlewares/shop-context.middleware';

export class InventoryRoute {
  public readonly router: Router;

  constructor(controller: InventoryController, shopContext: ShopContextMiddleware) {
    this.router = Router();
    this.initializeRoutes(controller, shopContext);
  }

  private initializeRoutes(controller: InventoryController, shopContext: ShopContextMiddleware): void {
    this.router.get('/inventory', shopContext.handle, controller.list);
    this.router.patch('/inventory/:id', shopContext.handle, controller.update);
  }
}

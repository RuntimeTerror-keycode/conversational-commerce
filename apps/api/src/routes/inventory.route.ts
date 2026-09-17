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
    // Declared before '/inventory/:id' so "catalog" is not parsed as an id.
    this.router.get('/inventory/catalog', shopContext.handle, controller.catalog);
    this.router.get('/inventory', shopContext.handle, controller.list);
    this.router.post('/inventory', shopContext.handle, controller.create);
    this.router.patch('/inventory/:id', shopContext.handle, controller.update);
    this.router.delete('/inventory/:id', shopContext.handle, controller.remove);
  }
}

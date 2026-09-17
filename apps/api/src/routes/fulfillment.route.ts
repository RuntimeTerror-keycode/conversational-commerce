import { Router } from 'express';
import { FulfillmentController } from '../controllers/fulfillment.controller';
import { ShopContextMiddleware } from '../middlewares/shop-context.middleware';

export class FulfillmentRoute {
  public readonly router: Router;

  constructor(controller: FulfillmentController, shopContext: ShopContextMiddleware) {
    this.router = Router();
    this.initializeRoutes(controller, shopContext);
  }

  private initializeRoutes(controller: FulfillmentController, shopContext: ShopContextMiddleware): void {
    this.router.get('/fulfillments', shopContext.handle, controller.list);
    this.router.get('/fulfillments/:id', shopContext.handle, controller.detail);
    this.router.patch('/fulfillments/:id', shopContext.handle, controller.updateStatus);
    this.router.patch('/fulfillments/:id/items/:lineId', shopContext.handle, controller.updateItem);
  }
}

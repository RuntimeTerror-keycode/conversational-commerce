import { Router } from 'express';
import { FulfillmentController } from '../controllers/fulfillment.controller';
import { ShopContextMiddleware } from '../middlewares/shop-context.middleware';

export class FulfillmentRoute {
  public readonly router: Router;

  constructor(controller: FulfillmentController, shopContext: ShopContextMiddleware) {
    this.router = Router();
    this.router.use(shopContext.handle);
    this.initializeRoutes(controller);
  }

  private initializeRoutes(controller: FulfillmentController): void {
    this.router.get('/fulfillments', controller.list);
    this.router.get('/fulfillments/:id', controller.detail);
    this.router.patch('/fulfillments/:id', controller.updateStatus);
    this.router.patch('/fulfillments/:id/items/:lineId', controller.updateItem);
  }
}

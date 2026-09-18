import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';
import { ServiceAuthMiddleware } from '../middlewares/service-auth.middleware';

export class OrderRoute {
  public readonly router: Router;

  constructor(controller: OrderController, serviceAuth: ServiceAuthMiddleware) {
    this.router = Router();
    this.initializeRoutes(controller, serviceAuth);
  }

  private initializeRoutes(controller: OrderController, serviceAuth: ServiceAuthMiddleware): void {
    this.router.post('/orders/confirm', serviceAuth.handle, controller.confirm);
    this.router.post('/orders', serviceAuth.handle, controller.place);
  }
}

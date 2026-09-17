import { Router } from 'express';
import { OrderController } from '../controllers/order.controller';

export class OrderRoute {
  public readonly router: Router;

  constructor(controller: OrderController) {
    this.router = Router();
    this.initializeRoutes(controller);
  }

  private initializeRoutes(controller: OrderController): void {
    this.router.post('/orders/confirm', controller.confirm);
    this.router.post('/orders', controller.place);
  }
}

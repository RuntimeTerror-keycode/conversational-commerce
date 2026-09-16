import { Router } from 'express';
import { CartController } from '../controllers/cart.controller';

export class CartRoute {
  public readonly router: Router;

  constructor(controller: CartController) {
    this.router = Router();
    this.initializeRoutes(controller);
  }

  private initializeRoutes(controller: CartController): void {
    this.router.get('/cart/:customerId', controller.read);
    this.router.patch('/cart/:customerId', controller.update);
  }
}

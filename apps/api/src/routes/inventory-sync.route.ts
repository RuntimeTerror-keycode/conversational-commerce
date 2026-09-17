import { Router } from 'express';
import { InventorySyncController } from '../controllers/inventory-sync.controller';

export class InventorySyncRoute {
  public readonly router: Router;

  constructor(controller: InventorySyncController) {
    this.router = Router();
    this.initializeRoutes(controller);
  }

  private initializeRoutes(controller: InventorySyncController): void {
    this.router.post('/inventory-sync/:software/:shopId', controller.receive);
  }
}

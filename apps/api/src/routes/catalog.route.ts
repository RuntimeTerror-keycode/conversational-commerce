import { Router } from 'express';
import { CatalogController } from '../controllers/catalog.controller';

export class CatalogRoute {
  public readonly router: Router;

  constructor(controller: CatalogController) {
    this.router = Router();
    this.initializeRoutes(controller);
  }

  private initializeRoutes(controller: CatalogController): void {
    this.router.get('/catalog/search', controller.search);
    this.router.post('/catalog/availability', controller.availability);
  }
}

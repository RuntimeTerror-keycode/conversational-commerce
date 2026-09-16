import { Router } from 'express';
import { IdentifyController } from '../controllers/identify.controller';

export class IdentifyRoute {
  public readonly router: Router;

  constructor(controller: IdentifyController) {
    this.router = Router();
    this.initializeRoutes(controller);
  }

  private initializeRoutes(controller: IdentifyController): void {
    this.router.post('/identify', controller.identify);
  }
}

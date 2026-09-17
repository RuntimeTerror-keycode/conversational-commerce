import { Router } from 'express';
import { WhatsappController } from '../controllers/whatsapp.controller';
import { ServiceAuthMiddleware } from '../middlewares/service-auth.middleware';

export class WhatsappRoute {
  public readonly router: Router;

  constructor(controller: WhatsappController, serviceAuth: ServiceAuthMiddleware) {
    this.router = Router();
    this.initializeRoutes(controller, serviceAuth);
  }

  private initializeRoutes(controller: WhatsappController, serviceAuth: ServiceAuthMiddleware): void {
    this.router.post('/whatsapp/orders/search', serviceAuth.handle, controller.search);
    this.router.post('/whatsapp/orders/select', serviceAuth.handle, controller.select);
  }
}

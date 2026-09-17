import { Application } from 'express';
import { AppControllers, AppMiddlewares } from '../setup';
import { HealthRoute } from './health.route';
import { IdentifyRoute } from './identify.route';
import { FulfillmentRoute } from './fulfillment.route';
import { InventoryRoute } from './inventory.route';
import { RetailerRoute } from './retailer.route';
import { CatalogRoute } from './catalog.route';
import { CartRoute } from './cart.route';
import { OrderRoute } from './order.route';

export class RouteRegistrar {
  private readonly app: Application;
  private readonly controllers: AppControllers;
  private readonly middlewares: AppMiddlewares;

  constructor(app: Application, controllers: AppControllers, middlewares: AppMiddlewares) {
    this.app = app;
    this.controllers = controllers;
    this.middlewares = middlewares;
  }

  public register(): void {
    const healthRoute = new HealthRoute(this.controllers.health);
    const identifyRoute = new IdentifyRoute(this.controllers.identify);
    const fulfillmentRoute = new FulfillmentRoute(this.controllers.fulfillment, this.middlewares.shopContext);
    const inventoryRoute = new InventoryRoute(this.controllers.inventory, this.middlewares.shopContext);
    const retailerRoute = new RetailerRoute(this.controllers.retailer);
    const catalogRoute = new CatalogRoute(this.controllers.catalog);
    const cartRoute = new CartRoute(this.controllers.cart);
    const orderRoute = new OrderRoute(this.controllers.order);

    this.app.use('/api', healthRoute.router);
    this.app.use('/api', identifyRoute.router);
    this.app.use('/api', fulfillmentRoute.router);
    this.app.use('/api', inventoryRoute.router);
    this.app.use('/api', retailerRoute.router);
    this.app.use('/api', catalogRoute.router);
    this.app.use('/api', cartRoute.router);
    this.app.use('/api', orderRoute.router);
  }
}

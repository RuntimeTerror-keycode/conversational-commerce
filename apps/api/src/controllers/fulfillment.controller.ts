import { Request, Response } from 'express';

import { FulfillmentService } from '../services/fulfillment.service';
import { defaultPageLimit, maxPageLimit } from '../constants';

export class FulfillmentController {
  private readonly service: FulfillmentService;

  constructor(service: FulfillmentService) {
    this.service = service;
  }

  /** GET /api/fulfillments */
  public list = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.list({
      shopId: req.shopId!,
      status: req.query.status as string | undefined,
      since: req.query.since as string | undefined,
      page: Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1),
      limit: Math.min(maxPageLimit, Math.max(1, parseInt(String(req.query.limit ?? String(defaultPageLimit)), 10) || defaultPageLimit)),
    });
    res.status(200).json(result);
  };

  /** GET /api/fulfillments/:id */
  public detail = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.detail(
      parseInt(String(req.params.id), 10),
      req.shopId!,
    );
    res.status(200).json(result);
  };

  /** PATCH /api/fulfillments/:id */
  public updateStatus = async (req: Request, res: Response): Promise<void> => {
    const { status } = req.body as { status?: string };
    const result = await this.service.updateStatus(
      parseInt(String(req.params.id), 10),
      req.shopId!,
      status as string,
    );
    res.status(200).json(result);
  };

  /** PATCH /api/fulfillments/:id/items/:lineId */
  public updateItem = async (req: Request, res: Response): Promise<void> => {
    const { quantity, substituteProductId, remove } = req.body as {
      quantity?: number;
      substituteProductId?: number;
      remove?: boolean;
    };
    const result = await this.service.updateItem({
      shopId: req.shopId!,
      fulfillmentId: parseInt(String(req.params.id), 10),
      lineId: parseInt(String(req.params.lineId), 10),
      quantity,
      substituteProductId,
      remove,
    });
    res.status(200).json(result);
  };
}

import { Request, Response } from 'express';

import { OrderPlacementService } from '../services/order-placement.service';

export class OrderController {
  private readonly service: OrderPlacementService;

  constructor(service: OrderPlacementService) {
    this.service = service;
  }

  /** POST /api/orders/confirm */
  public confirm = async (req: Request, res: Response): Promise<void> => {
    const { customerId, nearbyShopIds } = req.body as {
      customerId?: string;
      nearbyShopIds?: string[];
    };
    if (!customerId) {
      res.status(400).json({ status: 'error', code: 'bad_request', message: 'customerId is required' });
      return;
    }
    if (!nearbyShopIds || !Array.isArray(nearbyShopIds) || nearbyShopIds.length === 0) {
      res.status(400).json({ status: 'error', code: 'bad_request', message: 'nearbyShopIds is required and must be a non-empty array' });
      return;
    }
    const result = await this.service.requestConfirmation(customerId, nearbyShopIds);
    res.status(200).json(result);
  };

  /** POST /api/orders */
  public place = async (req: Request, res: Response): Promise<void> => {
    const { confirmationToken, opts } = req.body as {
      confirmationToken?: string;
      opts?: { deliveryNote?: string };
    };
    if (!confirmationToken) {
      res.status(400).json({ status: 'error', code: 'bad_request', message: 'confirmationToken is required' });
      return;
    }
    const result = await this.service.createOrder(confirmationToken, opts);

    if ('error' in result) {
      const statusMap: Record<string, number> = {
        not_found: 404,
        expired: 410,
        cart_changed: 409,
      };
      res.status(statusMap[result.reason] ?? 400).json(result);
      return;
    }

    res.status(201).json(result);
  };
}

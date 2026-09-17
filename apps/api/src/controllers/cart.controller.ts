import { Request, Response } from 'express';

import { CartOrchestrationService } from '../services/cart-orchestration.service';

export class CartController {
  private readonly service: CartOrchestrationService;

  constructor(service: CartOrchestrationService) {
    this.service = service;
  }

  /** GET /api/cart/:customerId */
  public read = async (req: Request<{ customerId: string }>, res: Response): Promise<void> => {
    const customerId = req.params.customerId;
    if (!customerId) {
      res.status(400).json({ status: 'error', code: 'bad_request', message: 'customerId is required' });
      return;
    }
    const result = await this.service.getCartByCustomer(customerId);
    res.status(200).json(result);
  };

  /** PATCH /api/cart/:customerId */
  public update = async (req: Request<{ customerId: string }>, res: Response): Promise<void> => {
    const customerId = req.params.customerId;
    if (!customerId) {
      res.status(400).json({ status: 'error', code: 'bad_request', message: 'customerId is required' });
      return;
    }
    const { op } = req.body as {
      op?: { action?: string; productId?: string; quantity?: number; unit?: string };
    };
    if (!op || !op.action || !op.productId) {
      res.status(400).json({ status: 'error', code: 'bad_request', message: 'op with action and productId is required' });
      return;
    }
    const result = await this.service.mutateCartByCustomer(customerId, {
      action: op.action as 'add' | 'remove' | 'set',
      productId: op.productId,
      quantity: op.quantity ?? 1,
      unit: op.unit ?? 'unit',
    });
    res.status(200).json(result);
  };
}

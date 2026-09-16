import { Request, Response } from 'express';

import { RetailerResolveService } from '../services/retailer-resolve.service';

export class RetailerController {
  private readonly service: RetailerResolveService;

  constructor(service: RetailerResolveService) {
    this.service = service;
  }

  /** GET /api/retailers/nearby?customerRef=... */
  public nearby = async (req: Request, res: Response): Promise<void> => {
    const customerRef = req.query.customerRef as string | undefined;
    if (!customerRef) {
      res.status(400).json({ status: 'error', code: 'bad_request', message: 'customerRef query param is required' });
      return;
    }
    const result = await this.service.resolve(customerRef);
    res.status(200).json(result);
  };
}

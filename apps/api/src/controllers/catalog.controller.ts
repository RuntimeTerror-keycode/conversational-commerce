import { Request, Response } from 'express';

import { CatalogSearchService } from '../services/catalog-search.service';

export class CatalogController {
  private readonly service: CatalogSearchService;

  constructor(service: CatalogSearchService) {
    this.service = service;
  }

  /** GET /api/catalog/search?customerId=...&query=...&limit=... */
  public search = async (req: Request, res: Response): Promise<void> => {
    const customerId = req.query.customerId as string | undefined;
    const query = req.query.query as string | undefined;
    const limitStr = req.query.limit as string | undefined;
    if (!customerId) {
      res.status(400).json({ status: 'error', code: 'bad_request', message: 'customerId is required' });
      return;
    }
    if (!query) {
      res.status(400).json({ status: 'error', code: 'bad_request', message: 'query is required' });
      return;
    }
    const opts = limitStr ? { limit: parseInt(limitStr, 10) } : undefined;
    const result = await this.service.searchProducts(customerId, query, opts);
    res.status(200).json(result);
  };

  /** POST /api/catalog/availability */
  public availability = async (req: Request, res: Response): Promise<void> => {
    const { retailerId, productIds } = req.body as {
      retailerId?: string;
      productIds?: string[];
    };
    if (!retailerId) {
      res.status(400).json({ status: 'error', code: 'bad_request', message: 'retailerId is required' });
      return;
    }
    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      res.status(400).json({ status: 'error', code: 'bad_request', message: 'productIds is required and must be a non-empty array' });
      return;
    }
    const result = await this.service.checkAvailability(retailerId, productIds);
    res.status(200).json(result);
  };
}

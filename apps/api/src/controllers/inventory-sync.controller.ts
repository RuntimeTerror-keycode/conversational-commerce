import { Request, Response } from 'express';

import { InventorySyncService } from '../services/inventory-sync.service';
import { inventorySoftwareNames, InventorySoftwareName } from '../constants';

export class InventorySyncController {
  private readonly service: InventorySyncService;

  constructor(service: InventorySyncService) {
    this.service = service;
  }

  /** POST /api/inventory-sync/:software/:shopId — async webhook */
  public receive = async (req: Request, res: Response): Promise<void> => {
    const software = String(req.params.software);
    const shopIdParam = String(req.params.shopId);

    if (!inventorySoftwareNames.includes(software as InventorySoftwareName)) {
      res.status(400).json({ error: 'unknown_software', message: `Unknown software: ${software}` });
      return;
    }

    const shopId = parseInt(shopIdParam, 10);
    if (isNaN(shopId) || shopId <= 0) {
      res.status(400).json({ error: 'invalid_shop_id', message: 'shopId must be a positive integer' });
      return;
    }

    res.status(202).json({ accepted: true });

    this.service
      .enqueue(software as InventorySoftwareName, shopId, req.body)
      .catch(() => { /* enqueue failure is logged inside the service */ });
  };
}

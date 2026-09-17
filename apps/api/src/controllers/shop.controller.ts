import { Request, Response } from 'express';

import { ShopService } from '../services/shop.service';
import { ShopSettingsUpdate } from '../types';

export class ShopController {
  private readonly service: ShopService;

  constructor(service: ShopService) {
    this.service = service;
  }

  /** GET /api/shops/me */
  public get = async (req: Request, res: Response): Promise<void> => {
    res.status(200).json(await this.service.get(req.shopId!));
  };

  /** PATCH /api/shops/me */
  public update = async (req: Request, res: Response): Promise<void> => {
    const input = req.body as ShopSettingsUpdate;
    res.status(200).json(await this.service.update(req.shopId!, input));
  };
}

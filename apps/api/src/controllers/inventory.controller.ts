import { Request, Response } from 'express';

import { InventoryService } from '../services/inventory.service';
import { defaultInventoryLimit, maxPageLimit } from '../constants';
import { InventoryCreateInput, InventoryUpdateInput } from '../types';

export class InventoryController {
  private readonly service: InventoryService;

  constructor(service: InventoryService) {
    this.service = service;
  }

  /** GET /api/inventory */
  public list = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.list({
      shopId: req.shopId!,
      q: req.query.q as string | undefined,
      category: req.query.category as string | undefined,
      stockState: req.query.stockState as string | undefined,
      page: Math.max(1, parseInt(String(req.query.page ?? '1'), 10) || 1),
      limit: Math.min(maxPageLimit, Math.max(1, parseInt(String(req.query.limit ?? String(defaultInventoryLimit)), 10) || defaultInventoryLimit)),
    });
    res.status(200).json(result);
  };

  /** GET /api/inventory/catalog — items this shop could stock. */
  public catalog = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.catalogOptions(
      req.shopId!,
      req.query.q as string | undefined,
      Math.min(maxPageLimit, Math.max(1, parseInt(String(req.query.limit ?? '25'), 10) || 25)),
    );
    res.status(200).json({ data: result });
  };

  /** POST /api/inventory */
  public create = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.create(req.shopId!, req.body as InventoryCreateInput);
    res.status(201).json(result);
  };

  /** DELETE /api/inventory/:id */
  public remove = async (req: Request, res: Response): Promise<void> => {
    await this.service.remove(parseInt(String(req.params.id), 10), req.shopId!);
    res.status(204).end();
  };

  /** PATCH /api/inventory/:id */
  public update = async (req: Request, res: Response): Promise<void> => {
    const input = req.body as InventoryUpdateInput;
    const result = await this.service.update(
      parseInt(String(req.params.id), 10),
      req.shopId!,
      input,
    );
    res.status(200).json(result);
  };
}

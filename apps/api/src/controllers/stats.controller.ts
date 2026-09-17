import { Request, Response } from 'express';
import { StatsService } from '../services/stats.service';

export class StatsController {
  private readonly service: StatsService;

  constructor(service: StatsService) {
    this.service = service;
  }

  /** GET /api/stats/today — everything behind the dashboard, in one call. */
  public today = async (req: Request, res: Response): Promise<void> => {
    const result = await this.service.dashboard(req.shopId!);
    res.status(200).json(result);
  };
}

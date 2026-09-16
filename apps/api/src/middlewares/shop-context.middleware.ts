import { Request, Response, NextFunction } from 'express';
import { Database } from '../lib/db';
import { AppError } from '../lib/app-error';
import { Logger } from '../logger/logger';

export class ShopContextMiddleware {
  private readonly db: Database;

  constructor(db: Database, _logger: Logger) {
    this.db = db;
  }

  public handle = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers['x-shop-id'];

    if (!header) {
      throw AppError.badRequest('Missing X-Shop-Id header');
    }

    const shopId = parseInt(String(header), 10);

    if (isNaN(shopId) || shopId <= 0) {
      throw AppError.badRequest('Invalid X-Shop-Id header — must be a positive integer');
    }

    const result = await this.db.query<{ id: number; is_active: boolean }>(
      'SELECT id, is_active FROM shop WHERE id = $1',
      [shopId],
    );

    if (result.rows.length === 0) {
      throw AppError.badRequest('Unknown shop');
    }

    if (!result.rows[0].is_active) {
      throw AppError.forbidden('Shop is inactive');
    }

    req.shopId = shopId;
    next();
  };
}

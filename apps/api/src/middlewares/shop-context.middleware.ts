import { Request, Response, NextFunction } from 'express';
import { AppError, IDatabase } from '@cc/domain';
import { Logger } from '../logger/logger';

export class ShopContextMiddleware {
  private readonly db: IDatabase;

  constructor(db: IDatabase, _logger: Logger) {
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

    const result = await this.db.query<{ id: number }>(
      'SELECT id FROM shop WHERE id = $1',
      [shopId],
    );

    if (result.rows.length === 0) {
      throw AppError.badRequest('Unknown shop');
    }

    // `is_active` is deliberately NOT checked here. It means "this shop is
    // taking customer orders", not "this shop may use its dashboard" — a
    // shopkeeper who switches the shop offline still has to pack the orders
    // already in flight, and locking them out of their own portal to do it
    // would make the offline toggle unusable.
    req.shopId = shopId;
    next();
  };
}

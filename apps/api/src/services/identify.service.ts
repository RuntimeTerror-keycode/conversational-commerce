import { AppError } from '../lib/app-error';
import { Logger } from '../logger/logger';
import { ShopUserRepository } from '../repositories/shop-user.repository';
import { IdentifyResponse } from '../types';

export class IdentifyService {
  private readonly repo: ShopUserRepository;
  private readonly logger: Logger;

  constructor(repo: ShopUserRepository, logger: Logger) {
    this.repo = repo;
    this.logger = logger.child('IdentifyService');
  }

  public async identify(username: string): Promise<IdentifyResponse> {
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      throw AppError.validation('username is required');
    }

    const row = await this.repo.findByUsername(username.trim().toLowerCase());

    if (!row) {
      throw AppError.unauthorized('No active user with that username');
    }

    this.logger.info('User identified', { username: row.username, shopId: row.shop_id });

    return {
      user: {
        id: row.user_id,
        username: row.username,
        name: row.user_name,
        role: row.role,
      },
      shop: {
        id: row.shop_id,
        name: row.shop_name,
        isActive: row.shop_is_active,
        inventoryMode: row.inventory_mode,
      },
    };
  }
}

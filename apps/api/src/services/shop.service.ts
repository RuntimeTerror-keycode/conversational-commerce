import { AppError, ShopRepository, ShopSettingsRow, isWithinOpeningHours } from '@cc/domain';
import { Logger } from '../logger/logger';

import { ShopSettings, ShopSettingsUpdate } from '../types';

/** "HH:MM" on a 24-hour clock. */
const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;

export class ShopService {
  private readonly repo: ShopRepository;
  private readonly logger: Logger;

  constructor(repo: ShopRepository, logger: Logger) {
    this.repo = repo;
    this.logger = logger.child('ShopService');
  }

  public async get(shopId: number): Promise<ShopSettings> {
    const row = await this.repo.findSettings(shopId);
    if (!row) throw AppError.notFound('Shop not found');
    return this.toSettings(row);
  }

  public async update(shopId: number, input: ShopSettingsUpdate): Promise<ShopSettings> {
    const current = await this.repo.findSettings(shopId);
    if (!current) throw AppError.notFound('Shop not found');

    const sets: string[] = [];
    const params: unknown[] = [];
    let idx = 1;

    if (input.name !== undefined) {
      const name = typeof input.name === 'string' ? input.name.trim() : '';
      // NOT NULL in the schema, and a shop with no name is unusable in the
      // sidebar, the order list and the customer's WhatsApp reply alike.
      if (name.length === 0) {
        throw AppError.validation('name cannot be empty');
      }
      if (name.length > 255) {
        throw AppError.validation('name must be 255 characters or fewer');
      }
      sets.push(`name = $${idx++}`);
      params.push(name);
    }

    if (input.ownerName !== undefined) {
      const owner =
        input.ownerName === null ? null : String(input.ownerName).trim() || null;
      if (owner !== null && owner.length > 255) {
        throw AppError.validation('ownerName must be 255 characters or fewer');
      }
      sets.push(`owner_name = $${idx++}`);
      params.push(owner);
    }

    if (input.isActive !== undefined) {
      if (typeof input.isActive !== 'boolean') {
        throw AppError.validation('isActive must be a boolean');
      }
      sets.push(`is_active = $${idx++}`);
      params.push(input.isActive);
    }

    if (input.openingTime !== undefined) {
      this.assertTime(input.openingTime, 'openingTime');
      sets.push(`opening_time = $${idx++}`);
      params.push(input.openingTime);
    }

    if (input.closingTime !== undefined) {
      this.assertTime(input.closingTime, 'closingTime');
      sets.push(`closing_time = $${idx++}`);
      params.push(input.closingTime);
    }

    if (sets.length === 0) {
      throw AppError.validation('No supported fields to update');
    }

    // Both times must end up set or both cleared — a shop with only a closing
    // time has no meaningful open/closed state.
    const nextOpening =
      input.openingTime !== undefined ? input.openingTime : current.opening_time;
    const nextClosing =
      input.closingTime !== undefined ? input.closingTime : current.closing_time;

    if ((nextOpening === null) !== (nextClosing === null)) {
      throw AppError.validation(
        'openingTime and closingTime must be set together, or both cleared',
      );
    }

    const row = await this.repo.updateSettings(shopId, sets, params);
    this.logger.info('Shop settings updated', { shopId, fields: Object.keys(input) });

    return this.toSettings(row);
  }

  private assertTime(value: string | null, field: string): void {
    if (value === null) return;
    if (typeof value !== 'string' || !timePattern.test(value)) {
      throw AppError.validation(`${field} must be "HH:MM" on a 24-hour clock`);
    }
  }

  private toSettings(row: ShopSettingsRow): ShopSettings {
    return {
      id: row.id,
      name: row.name,
      ownerName: row.owner_name,
      phone: row.phone,
      openingTime: row.opening_time,
      closingTime: row.closing_time,
      isActive: row.is_active,
      inventoryMode: row.inventory_mode,
      deliveryRadiusKm:
        row.delivery_radius_km === null ? null : parseFloat(row.delivery_radius_km),
      openState: ShopService.openState(
        row.is_active,
        row.opening_time,
        row.closing_time,
      ),
    };
  }

  /**
   * Delegates the actual time-window math to packages/domain's
   * isWithinOpeningHours — the same function RetailerResolveService uses to
   * actually gate orders — so the dashboard and the real order flow can
   * never disagree about whether a shop is taking orders.
   */
  public static openState(
    isActive: boolean,
    openingTime: string | null,
    closingTime: string | null,
    now: Date = new Date(),
  ): ShopSettings['openState'] {
    if (!isActive) return 'offline';
    if (!openingTime || !closingTime) return 'always_open';

    return isWithinOpeningHours(openingTime, closingTime, now) ? 'open' : 'closed';
  }
}

import { ShopProductRepository, StatsRepository } from '@cc/domain';
import { Logger } from '../logger/logger';
import {
  BusiestHours,
  DashboardStats,
  LowStockProduct,
  SpeedToday,
  TakingsToday,
} from '../types';

/** Days averaged over. A week covers every weekday exactly once. */
const WINDOW_DAYS = 7;

/** How many low/out products the dashboard shows before it stops being a summary. */
const RUNNING_OUT_LIMIT = 4;

export class StatsService {
  private readonly statsRepo: StatsRepository;
  private readonly shopProductRepo: ShopProductRepository;
  private readonly logger: Logger;

  constructor(
    statsRepo: StatsRepository,
    shopProductRepo: ShopProductRepository,
    logger: Logger,
  ) {
    this.statsRepo = statsRepo;
    this.shopProductRepo = shopProductRepo;
    this.logger = logger.child('StatsService');
  }

  public async dashboard(shopId: number): Promise<DashboardStats> {
    const [hourly, today, lastWeek, speed, low, out] = await Promise.all([
      this.statsRepo.ordersByHour(shopId, WINDOW_DAYS),
      this.statsRepo.takingsForDay(shopId, 0),
      this.statsRepo.takingsForDay(shopId, WINDOW_DAYS),
      this.statsRepo.speedToday(shopId),
      this.shopProductRepo.findByShop({
        shopId, stockState: 'low', limit: RUNNING_OUT_LIMIT, offset: 0,
      }),
      this.shopProductRepo.findByShop({
        shopId, stockState: 'out', limit: RUNNING_OUT_LIMIT, offset: 0,
      }),
    ]);

    // Out-of-stock first: a product nobody can order is worse than one running
    // low, and the shopkeeper should meet it at the top of the list.
    const products = [...out, ...low].slice(0, RUNNING_OUT_LIMIT);
    const velocity = await this.statsRepo.velocity(
      shopId,
      products.map((product) => product.id),
      WINDOW_DAYS,
    );
    const perDay = new Map(velocity.map((row) => [row.shop_product_id, parseFloat(row.per_day)]));

    const revenue = parseFloat(today.revenue);
    const previousRevenue = parseFloat(lastWeek.revenue);

    const takingsToday: TakingsToday = {
      revenue,
      orders: parseInt(today.orders, 10),
      items: parseInt(today.items, 10),
      previousRevenue,
      changeOnLastWeek: revenue - previousRevenue,
    };

    const runningOut: LowStockProduct[] = products.map((product) => ({
      id: product.id,
      name: product.local_name ?? product.catalog_name,
      category: product.category_name,
      stockQuantity: product.stock_quantity,
      isAvailable: product.is_available,
      sellsPerDay: perDay.get(product.id) ?? null,
    }));

    this.logger.info('Dashboard stats built', { shopId, runningOut: runningOut.length });

    return {
      busiestHours: this.buildBusiestHours(hourly),
      takingsToday,
      speedToday: this.buildSpeed(speed),
      runningOut,
      serverTime: new Date().toISOString(),
    };
  }

  /**
   * Zero-fill the day so the chart always has 24 bars.
   *
   * A quiet hour is a real answer — leaving it out would make the bars lie
   * about which part of the day is busy.
   */
  private buildBusiestHours(
    rows: Array<{ hour: number; average: string }>,
  ): BusiestHours {
    const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, average: 0 }));
    for (const row of rows) {
      buckets[row.hour] = { hour: row.hour, average: parseFloat(row.average) };
    }

    let peakHour: number | null = null;
    let peakAverage = 0;
    for (const bucket of buckets) {
      if (bucket.average > peakAverage) {
        peakAverage = bucket.average;
        peakHour = bucket.hour;
      }
    }

    return { buckets, peakHour, peakAverage, windowDays: WINDOW_DAYS };
  }

  private buildSpeed(row: {
    accepted_to_packed_seconds: string | null;
    packed_to_delivered_seconds: string | null;
    slowest_seconds: string | null;
    slowest_order_code: string | null;
  }): SpeedToday {
    const num = (value: string | null): number | null =>
      value === null ? null : Math.round(parseFloat(value));

    return {
      acceptedToPackedSeconds: num(row.accepted_to_packed_seconds),
      packedToDeliveredSeconds: num(row.packed_to_delivered_seconds),
      slowestSeconds: num(row.slowest_seconds),
      slowestOrderCode: row.slowest_order_code,
    };
  }
}

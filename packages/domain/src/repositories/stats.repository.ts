import { IDatabase } from '../types';

/**
 * The shop's own clock.
 *
 * Postgres runs UTC here, so an unqualified `date_trunc('day', NOW())` means
 * midnight UTC — half past five in the morning in Kerala. A day's takings
 * would report yesterday's figure until 05:30, and the hour-of-day histogram
 * would be shifted by five and a half hours. Every window below is therefore
 * anchored explicitly, rather than trusting the server's configuration.
 *
 * Single-region build: when this serves more than Kerala it belongs on the
 * shop row, not in a constant.
 */
const SHOP_TZ = 'Asia/Kolkata';

/** Local midnight, `days` back, as a timestamptz the columns can be compared to. */
const localMidnight = (daysBack: string) =>
  `(date_trunc('day', NOW() AT TIME ZONE '${SHOP_TZ}') - make_interval(days => ${daysBack})) AT TIME ZONE '${SHOP_TZ}'`;

/**
 * Aggregates behind the "Today" screen.
 *
 * Everything here is a whole-table roll-up, not a page. The dashboard cannot
 * add up a page of orders and call it a day's takings — the figure would go
 * quietly wrong the moment a shop has more orders than fit on one page — so
 * the sums happen in SQL, scoped to the shop.
 *
 */

export interface HourlyOrderRow {
  hour: number;
  /** Orders in that hour per day, averaged over the window. */
  average: string;
}

export interface TakingsRow {
  revenue: string;
  orders: string;
  items: string;
}

export interface SpeedRow {
  accepted_to_packed_seconds: string | null;
  packed_to_delivered_seconds: string | null;
  slowest_seconds: string | null;
  slowest_order_code: string | null;
}

export interface ProductVelocityRow {
  shop_product_id: number;
  /** Units sold per day, averaged over the window. */
  per_day: string;
}

export class StatsRepository {
  private readonly db: IDatabase;

  constructor(db: IDatabase) {
    this.db = db;
  }

  /**
   * Orders per hour of day, averaged across the window.
   *
   * Only hours that saw an order come back — the caller fills the gaps, since
   * a missing hour is a zero and there is no point shipping 24 rows to say so.
   */
  public async ordersByHour(shopId: number, days: number): Promise<HourlyOrderRow[]> {
    const result = await this.db.query<HourlyOrderRow>(
      `SELECT EXTRACT(HOUR FROM accepted_at AT TIME ZONE 'Asia/Kolkata')::int AS hour,
              (COUNT(*)::numeric / $2)::text                       AS average
         FROM fulfillment
        WHERE shop_id = $1
          AND accepted_at >= ${localMidnight('$2::int')}
        GROUP BY 1
        ORDER BY 1`,
      [shopId, days],
    );

    return result.rows;
  }

  /**
   * Delivered takings for one day, `offsetDays` back from today.
   *
   * `0` is today; `7` is the same weekday last week, which is the only
   * comparison worth showing a shopkeeper — a Thursday against a Thursday.
   */
  public async takingsForDay(shopId: number, offsetDays: number): Promise<TakingsRow> {
    const result = await this.db.query<TakingsRow>(
      // Items are counted in a subquery, not a join. Joining order_item here
      // would repeat each fulfillment once per line and inflate the takings by
      // the number of items in the basket.
      `WITH day AS (
         SELECT ${localMidnight('$2::int')} AS start
       ),
       sold AS (
         SELECT f.id, f.subtotal,
                (SELECT COALESCE(SUM(i.quantity), 0)
                   FROM order_item i WHERE i.fulfillment_id = f.id) AS units
           FROM day, fulfillment f
          WHERE f.shop_id = $1
            AND f.status = 'delivered'
            AND f.delivered_at >= day.start
            AND f.delivered_at <  day.start + interval '1 day'
       )
       SELECT COALESCE(SUM(subtotal), 0)::text AS revenue,
              COUNT(*)::text                   AS orders,
              COALESCE(SUM(units), 0)::text    AS items
         FROM sold`,
      [shopId, offsetDays],
    );

    return result.rows[0];
  }

  /**
   * How long today's delivered orders took, and the worst one.
   *
   * Averages skip rows missing a timestamp rather than treating them as zero,
   * which would quietly flatter the number.
   */
  public async speedToday(shopId: number): Promise<SpeedRow> {
    const result = await this.db.query<SpeedRow>(
      `SELECT
         AVG(EXTRACT(EPOCH FROM (f.packed_at - f.accepted_at)))
           FILTER (WHERE f.packed_at IS NOT NULL AND f.accepted_at IS NOT NULL)::text
             AS accepted_to_packed_seconds,
         AVG(EXTRACT(EPOCH FROM (f.delivered_at - f.packed_at)))
           FILTER (WHERE f.delivered_at IS NOT NULL AND f.packed_at IS NOT NULL)::text
             AS packed_to_delivered_seconds,
         MAX(EXTRACT(EPOCH FROM (f.delivered_at - f.accepted_at)))::text
             AS slowest_seconds,
         (SELECT m.order_code
            FROM fulfillment s
            JOIN master_order m ON m.id = s.master_order_id
           WHERE s.shop_id = $1
             AND s.status = 'delivered'
             AND s.delivered_at >= ${localMidnight('0')}
           ORDER BY (s.delivered_at - s.accepted_at) DESC NULLS LAST
           LIMIT 1) AS slowest_order_code
       FROM fulfillment f
      WHERE f.shop_id = $1
        AND f.status = 'delivered'
        AND f.delivered_at >= ${localMidnight('0')}`,
      [shopId],
    );

    return result.rows[0];
  }

  /**
   * Units sold per day for the given shop products, averaged over the window.
   *
   * This is what turns "3 left" into "3 left, and it sells about 6 a day" —
   * the difference between a number and a reason to act on it.
   */
  public async velocity(
    shopId: number,
    shopProductIds: number[],
    days: number,
  ): Promise<ProductVelocityRow[]> {
    if (shopProductIds.length === 0) return [];

    const result = await this.db.query<ProductVelocityRow>(
      `SELECT i.shop_product_id,
              (SUM(i.quantity)::numeric / $3)::text AS per_day
         FROM order_item i
         JOIN fulfillment f ON f.id = i.fulfillment_id
        WHERE f.shop_id = $1
          AND i.shop_product_id = ANY($2::int[])
          AND f.status = 'delivered'
          AND f.delivered_at >= ${localMidnight('$3::int')}
        GROUP BY i.shop_product_id`,
      [shopId, shopProductIds, days],
    );

    return result.rows;
  }
}

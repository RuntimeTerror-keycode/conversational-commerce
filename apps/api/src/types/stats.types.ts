/** Payload behind the "Today" screen. Whole-shop roll-ups, never page sums. */

export interface HourlyBucket {
  /** 0–23, local to the database's timezone. */
  hour: number;
  /** Orders in that hour on an average day of the window. */
  average: number;
}

export interface BusiestHours {
  /** One entry per hour of the day, zero-filled. */
  buckets: HourlyBucket[];
  /** Hour with the highest average, or null when there is no history at all. */
  peakHour: number | null;
  peakAverage: number;
  /** How many days were averaged over. */
  windowDays: number;
}

export interface TakingsToday {
  revenue: number;
  orders: number;
  /** Units, not lines — "11 items sold" means eleven things left the shelf. */
  items: number;
  /** Same weekday last week, for a like-for-like comparison. */
  previousRevenue: number;
  /** `revenue - previousRevenue`; negative is a worse day. */
  changeOnLastWeek: number;
}

export interface SpeedToday {
  acceptedToPackedSeconds: number | null;
  packedToDeliveredSeconds: number | null;
  slowestSeconds: number | null;
  slowestOrderCode: string | null;
}

export interface LowStockProduct {
  id: number;
  name: string;
  category: string | null;
  stockQuantity: number;
  isAvailable: boolean;
  /** Units sold per day over the window, or null when it has never sold. */
  sellsPerDay: number | null;
}

export interface DashboardStats {
  busiestHours: BusiestHours;
  takingsToday: TakingsToday;
  speedToday: SpeedToday;
  runningOut: LowStockProduct[];
  serverTime: string;
}

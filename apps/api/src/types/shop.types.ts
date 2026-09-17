export interface ShopSettings {
  id: number;
  name: string;
  ownerName: string | null;
  phone: string;
  /** "HH:MM", or null when the shop has not set hours. */
  openingTime: string | null;
  closingTime: string | null;
  /** Whether the shop is taking orders. Set false to go offline. */
  isActive: boolean;
  inventoryMode: string;
  deliveryRadiusKm: number | null;
  /**
   * Derived server-side so every client agrees on it.
   *
   *   offline       — the shopkeeper switched the shop off
   *   closed        — outside opening hours right now
   *   open          — taking orders
   *   always_open   — active but no hours configured
   */
  openState: 'open' | 'closed' | 'offline' | 'always_open';
}

export interface ShopSettingsUpdate {
  name?: string;
  ownerName?: string | null;
  isActive?: boolean;
  openingTime?: string | null;
  closingTime?: string | null;
}

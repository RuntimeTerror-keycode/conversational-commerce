export interface IdentifyRequest {
  username: string;
}

export interface IdentifyUser {
  id: number;
  username: string;
  name: string;
  role: string;
}

export interface IdentifyShop {
  id: number;
  name: string;
  isActive: boolean;
  inventoryMode: string;
  /** "HH:MM", or null when the shop has not set hours. */
  openingTime: string | null;
  closingTime: string | null;
  /** Derived from isActive + hours. See ShopService.openState. */
  openState: 'open' | 'closed' | 'offline' | 'always_open';
}

export interface IdentifyResponse {
  user: IdentifyUser;
  shop: IdentifyShop;
}

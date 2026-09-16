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
}

export interface IdentifyResponse {
  user: IdentifyUser;
  shop: IdentifyShop;
}

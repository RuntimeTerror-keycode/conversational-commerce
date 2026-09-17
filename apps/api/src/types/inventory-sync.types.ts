import { InventorySoftwareName } from '../constants';

// ---------------------------------------------------------------------------
// Queue envelope — what the webhook publishes to RabbitMQ
// ---------------------------------------------------------------------------

export interface InventorySyncEnvelope {
  software: InventorySoftwareName;
  shopId: number;
  receivedAt: string;
  payload: unknown;
}

// ---------------------------------------------------------------------------
// Normalized item — common shape all handlers produce
// ---------------------------------------------------------------------------

export interface NormalizedInventoryItem {
  name: string;
  brand: string | null;
  category: string;
  unit: string;
  sku: string | null;
  regularPrice: number;
  sellingPrice: number;
  stockQuantity: number;
  isAvailable: boolean;
}

// ---------------------------------------------------------------------------
// Handler interface — one per inventory software
// ---------------------------------------------------------------------------

export interface InventorySoftwareHandler {
  /** Extract a flat list of normalized items from the raw payload. */
  normalize(payload: unknown): NormalizedInventoryItem[];
}

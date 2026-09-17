import { InventorySoftwareHandler, NormalizedInventoryItem } from '../../types';

/** Payload shape pushed by the FreshKart grocery POS (inventory_mimick/app_1). */
interface FreshKartPayload {
  retailerId: string;
  retailerName: string;
  area: string;
  pushedAt: string;
  products: {
    id: string;
    name: string;
    category: string;
    unit: string;
    price: string;
    stock: number;
    inStock: boolean;
  }[];
}

export class FreshKartHandler implements InventorySoftwareHandler {
  public normalize(payload: unknown): NormalizedInventoryItem[] {
    const data = payload as FreshKartPayload;

    if (!Array.isArray(data.products)) {
      throw new Error('FreshKart payload missing products array');
    }

    return data.products.map((p) => ({
      name: p.name,
      brand: null,
      category: p.category,
      unit: p.unit,
      sku: null,
      regularPrice: parseFloat(p.price),
      sellingPrice: parseFloat(p.price),
      stockQuantity: p.stock,
      isAvailable: p.inStock,
    }));
  }
}

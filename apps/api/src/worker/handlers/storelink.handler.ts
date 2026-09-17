import { InventorySoftwareHandler, NormalizedInventoryItem } from '../../types';

/** Payload shape pushed by the StoreLink POS (inventory_mimick/app_2). */
interface StoreLinkPayload {
  source: string;
  storeCode: string;
  storeName: string;
  locality: string;
  city: string;
  syncedAt: string;
  catalog: {
    categoryName: string;
    categoryOrder: number;
    items: {
      sku: string;
      name: string;
      brand: string | null;
      variant: string | null;
      mrp: string;
      sellingPrice: string;
      unit: string;
      quantityOnHand: number;
      lowStock: boolean;
      status: string;
    }[];
  }[];
}

export class StoreLinkHandler implements InventorySoftwareHandler {
  public normalize(payload: unknown): NormalizedInventoryItem[] {
    const data = payload as StoreLinkPayload;

    if (!Array.isArray(data.catalog)) {
      throw new Error('StoreLink payload missing catalog array');
    }

    const items: NormalizedInventoryItem[] = [];

    for (const category of data.catalog) {
      for (const item of category.items) {
        items.push({
          name: item.variant ? `${item.name} (${item.variant})` : item.name,
          brand: item.brand,
          category: category.categoryName,
          unit: item.unit,
          sku: item.sku,
          regularPrice: parseFloat(item.mrp),
          sellingPrice: parseFloat(item.sellingPrice),
          stockQuantity: item.quantityOnHand,
          isAvailable: item.status === 'active' && item.quantityOnHand > 0,
        });
      }
    }

    return items;
  }
}

import { CategoryRepository, CatalogRepository, ShopProductRepository, ShopRepository } from '@cc/domain';
import { MessageBroker } from '../lib/rabbitmq';
import { Database } from '../lib/db';
import { Logger } from '../logger/logger';
import { InventorySoftwareName, inventorySyncQueue, isManagedInventory } from '../constants';
import { InventorySyncEnvelope, NormalizedInventoryItem } from '../types';

export class InventorySyncService {
  private readonly broker: MessageBroker;
  private readonly db: Database;
  private readonly categoryRepo: CategoryRepository;
  private readonly catalogRepo: CatalogRepository;
  private readonly shopProductRepo: ShopProductRepository;
  private readonly shopRepo: ShopRepository;
  private readonly logger: Logger;

  constructor(
    broker: MessageBroker,
    db: Database,
    categoryRepo: CategoryRepository,
    catalogRepo: CatalogRepository,
    shopProductRepo: ShopProductRepository,
    shopRepo: ShopRepository,
    logger: Logger,
  ) {
    this.broker = broker;
    this.db = db;
    this.categoryRepo = categoryRepo;
    this.catalogRepo = catalogRepo;
    this.shopProductRepo = shopProductRepo;
    this.shopRepo = shopRepo;
    this.logger = logger.child('InventorySyncService');
  }

  /** Wrap the raw payload into an envelope and push to the sync queue. */
  public async enqueue(
    software: InventorySoftwareName,
    shopId: number,
    payload: unknown,
  ): Promise<void> {
    const envelope: InventorySyncEnvelope = {
      software,
      shopId,
      receivedAt: new Date().toISOString(),
      payload,
    };

    await this.broker.publish(inventorySyncQueue, envelope as unknown as Record<string, unknown>);
    this.logger.info('Enqueued inventory sync', { software, shopId });
  }

  /**
   * Apply a normalized inventory snapshot to the DB for a given shop.
   *
   * For each item: find-or-create category → find-or-create catalog entry →
   * upsert shop_product with current stock and pricing.
   *
   * After upserting every item from the payload, any shop_product rows for
   * this shop whose catalog_id was NOT in the payload are marked unavailable
   * (stock 0). This treats the incoming push as a full-state snapshot.
   *
   * Refused unless the shop is on `inventory_mode = 'synced'`. A `managed`
   * shop's stock is maintained by the shopkeeper in the portal, and because
   * this is a full-state snapshot, applying one here would not merely add
   * rows — every product missing from the push would be zeroed. The dashboard
   * already refuses writes for `synced` shops; this is the same rule pointing
   * the other way, so the two modes are exclusive in code and not just by
   * convention.
   */
  public async syncToDb(shopId: number, items: NormalizedInventoryItem[]): Promise<number> {
    const shop = await this.shopRepo.findSettings(shopId);

    if (!shop) {
      this.logger.error('Inventory sync for unknown shop, dropping', { shopId });
      return 0;
    }

    if (isManagedInventory(shop.inventory_mode)) {
      this.logger.error('Inventory sync refused: shop manages its own stock here', {
        shopId, shopName: shop.name, inventoryMode: shop.inventory_mode, items: items.length,
      });
      return 0;
    }

    let synced = 0;

    await this.db.transaction(async (client) => {
      const touchedCatalogIds: number[] = [];

      for (const item of items) {
        const categoryId = await this.categoryRepo.findByNameTx(client, item.category)
          ?? await this.categoryRepo.insertTx(client, item.category);

        const catalogId = await this.catalogRepo.findByNameAndBrandTx(client, item.name, item.brand)
          ?? await this.catalogRepo.insertTx(client, item.name, item.brand, categoryId, item.unit, item.sku);

        await this.shopProductRepo.upsertTx(
          client, shopId, catalogId,
          item.regularPrice, item.sellingPrice, item.stockQuantity, item.isAvailable,
        );

        touchedCatalogIds.push(catalogId);
        synced++;
      }

      const staleCount = await this.shopProductRepo.markStaleUnavailableTx(
        client, shopId, touchedCatalogIds,
      );

      if (staleCount > 0) {
        this.logger.info('Marked stale products unavailable', { shopId, staleCount });
      }
    });

    return synced;
  }
}

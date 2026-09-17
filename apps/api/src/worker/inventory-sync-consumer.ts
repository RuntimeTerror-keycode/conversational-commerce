import { MessageBroker } from '../lib/rabbitmq';
import { Logger } from '../logger/logger';
import { inventorySyncQueue, inventorySoftwareNames, InventorySoftwareName } from '../constants';
import { InventorySyncEnvelope } from '../types';
import { InventorySyncService } from '../services/inventory-sync.service';
import { getHandler } from './handlers';

export class InventorySyncConsumer {
  private readonly syncService: InventorySyncService;
  private readonly broker: MessageBroker;
  private readonly logger: Logger;

  constructor(syncService: InventorySyncService, broker: MessageBroker, logger: Logger) {
    this.syncService = syncService;
    this.broker = broker;
    this.logger = logger.child('InventorySyncConsumer');
  }

  public async start(): Promise<void> {
    await this.broker.subscribe<InventorySyncEnvelope>(
      inventorySyncQueue,
      async (envelope) => {
        const { software, shopId, receivedAt } = envelope;

        if (!inventorySoftwareNames.includes(software as InventorySoftwareName)) {
          this.logger.error('Unknown software in queue message, skipping', { software, shopId });
          return;
        }

        this.logger.info('Processing inventory sync', { software, shopId, receivedAt });

        const handler = getHandler(software);
        const items = handler.normalize(envelope.payload);

        const synced = await this.syncService.syncToDb(shopId, items);
        this.logger.info('Inventory sync complete', { software, shopId, synced });
      },
      { prefetch: 1 },
    );

    this.logger.info(`Listening on queue "${inventorySyncQueue}"`);
  }
}

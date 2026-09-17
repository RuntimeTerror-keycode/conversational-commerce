import { CategoryRepository, CatalogRepository, ShopProductRepository, ShopRepository } from '@cc/domain';
import { Config } from './config/config';
import { Logger } from './logger/logger';
import { Database } from './lib/db';
import { MessageBroker } from './lib/rabbitmq';
import { InventorySyncService } from './services/inventory-sync.service';
import { InventorySyncConsumer } from './worker/inventory-sync-consumer';

async function bootstrap(): Promise<void> {
  const config = Config.getInstance();
  const logger = new Logger(config, 'Worker');
  const db = new Database(config.values.databaseUrl, logger);
  const broker = new MessageBroker(config.values.rabbitmqUrl, logger);

  await broker.connect();
  logger.info('RabbitMQ connected');

  const categoryRepo = new CategoryRepository(db);
  const catalogRepo = new CatalogRepository(db);
  const shopProductRepo = new ShopProductRepository(db);
  const shopRepo = new ShopRepository(db);

  const syncService = new InventorySyncService(
    broker, db, categoryRepo, catalogRepo, shopProductRepo, shopRepo, logger,
  );

  const consumer = new InventorySyncConsumer(syncService, broker, logger);
  await consumer.start();

  logger.info('Inventory sync worker running');

  const shutdown = async () => {
    logger.info('Shutting down worker...');
    await broker.close();
    await db.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('Worker failed to start', err);
  process.exit(1);
});

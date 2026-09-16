import { Setup } from './setup';
import { App } from './app';

async function bootstrap(): Promise<void> {
  const deps = Setup.createDependencies();

  await deps.broker.connect();

  const app = new App(deps);
  app.listen();

  const shutdown = async () => {
    deps.logger.info('Shutting down...');
    await deps.broker.close();
    await deps.db.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('Failed to start', err);
  process.exit(1);
});

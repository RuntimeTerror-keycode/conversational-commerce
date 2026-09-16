import { Setup } from './setup';
import { App } from './app';

function bootstrap(): void {
  const deps = Setup.createDependencies();
  const app = new App(deps);
  app.listen();
}

bootstrap();

import { InventorySoftwareName } from '../../constants';
import { InventorySoftwareHandler } from '../../types';
import { FreshKartHandler } from './freshkart.handler';
import { StoreLinkHandler } from './storelink.handler';

const registry: Record<InventorySoftwareName, InventorySoftwareHandler> = {
  freshkart: new FreshKartHandler(),
  storelink: new StoreLinkHandler(),
};

export function getHandler(software: InventorySoftwareName): InventorySoftwareHandler {
  return registry[software];
}

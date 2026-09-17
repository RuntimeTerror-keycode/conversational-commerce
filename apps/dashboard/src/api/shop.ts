import { request } from './client';
import type { ShopSettings, ShopSettingsUpdate } from './types';

export function fetchShopSettings(): Promise<ShopSettings> {
  return request<ShopSettings>('/shops/me');
}

export function updateShopSettings(patch: ShopSettingsUpdate): Promise<ShopSettings> {
  return request<ShopSettings>('/shops/me', { method: 'PATCH', body: patch });
}

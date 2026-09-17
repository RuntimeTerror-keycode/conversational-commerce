import { DomainCart } from '@cc/domain';

export interface WhatsappAddress {
  addressLine?: string;
  latitude: number;
  longitude: number;
}

export interface WhatsappSearchRequest {
  messageId: string;
  customerRef: string;
  text: string;
  source: 'text' | 'voice';
  timestamp: string;
  address: WhatsappAddress;
  paymentMode: 'COD' | 'GPAY';
}

export interface WhatsappRow {
  id: number;
  title: string;
  description?: string;
  price: string;
}

export type WhatsappSearchResponse =
  | { customerRef: string; orderId: number; tag: 'found'; rows: WhatsappRow[] }
  | { customerRef: string; orderId: number; tag: 'choice'; body: string; rows: WhatsappRow[] }
  | { customerRef: string; orderId: number; tag: 'not_found'; body: string };

export interface WhatsappSelectRequest {
  customerRef: string;
  orderId: number;
  productId: number;
}

export interface WhatsappSubstitute {
  id: number;
  name: string;
  unit: string;
  price: number;
}

export type WhatsappSelectResponse =
  | { customerRef: string; orderId: number; tag: 'added'; cart: DomainCart }
  | { customerRef: string; orderId: number; tag: 'unavailable'; body: string; substitutes: WhatsappSubstitute[] };

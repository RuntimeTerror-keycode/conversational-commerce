import type { FulfillmentStatus } from '@/api/types';
import type { Tone } from '@/components/ui/Badge';

export interface StageMeta {
  label: string;
  hint: string;
  tone: Tone;
  /** What the row's button says at this stage. */
  action: string;
  emptyTitle: string;
  emptyBody: string;
}

/**
 * One entry per stage the work queue shows.
 *
 * The hints matter more than they look: a shopkeeper who has just opened the
 * portal for the first time learns the whole model from them — that orders
 * arrive already accepted, and that their job starts at bagging.
 */
export const stageMeta: Record<
  Extract<FulfillmentStatus, 'accepted' | 'packed' | 'out_for_delivery'>,
  StageMeta
> = {
  accepted: {
    label: 'New',
    hint: 'Already accepted by the system. Bag them in the order they arrived.',
    tone: 'warning',
    action: 'Mark packed',
    emptyTitle: 'Nothing waiting',
    emptyBody: 'New WhatsApp orders land here the moment they arrive.',
  },
  packed: {
    label: 'Packed',
    hint: 'Bagged and waiting for the next delivery run or a pickup.',
    tone: 'info',
    action: 'Hand to delivery',
    emptyTitle: 'Nothing packed',
    emptyBody: 'Orders you mark packed wait here for the delivery run.',
  },
  out_for_delivery: {
    label: 'Out for delivery',
    hint: 'With the driver. Mark each one off as it lands.',
    tone: 'violet',
    action: 'Mark delivered',
    emptyTitle: 'Nothing out for delivery',
    emptyBody: 'Orders on their way show here until they are delivered.',
  },
};

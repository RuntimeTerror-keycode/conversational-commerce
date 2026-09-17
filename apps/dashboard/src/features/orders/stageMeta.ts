import type { FulfillmentStatus } from '@/api/types';
import type { Tone } from '@/components/ui/Badge';

export interface StageMeta {
  label: string;
  hint: string;
  tone: Tone;
  emptyTitle: string;
  emptyBody: string;
}

/**
 * One entry per stage the work queue shows.
 *
 * The hint sits under the stage badge and says what the pile in front of the
 * shopkeeper actually is, so the tab name does not have to carry it alone.
 */
export const stageMeta: Record<
  Extract<FulfillmentStatus, 'accepted' | 'packed' | 'out_for_delivery'>,
  StageMeta
> = {
  accepted: {
    label: 'New',
    hint: 'Oldest first — bag them in the order they came in.',
    tone: 'warning',
    emptyTitle: 'Nothing waiting',
    emptyBody: 'New WhatsApp orders land here the moment they arrive.',
  },
  packed: {
    label: 'Packed',
    hint: 'Bagged and waiting for the delivery run, or for the customer to come by.',
    tone: 'info',
    emptyTitle: 'Nothing packed',
    emptyBody: 'Orders you mark packed wait here for the delivery run.',
  },
  out_for_delivery: {
    label: 'Out for delivery',
    hint: 'On the way, or waiting on the counter. Mark each one off as it lands.',
    tone: 'violet',
    emptyTitle: 'Nothing out for delivery',
    emptyBody: 'Orders on their way show here until they are delivered.',
  },
};

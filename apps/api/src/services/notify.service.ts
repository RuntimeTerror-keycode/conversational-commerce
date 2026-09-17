import { randomUUID } from 'crypto';
import { NotifyRequest, ReplyBlock } from '@cc/contracts';
import { EdgeNotifyClient } from '../lib/edge-notify-client';

export type NotifyReason = 'order_accepted' | 'order_rejected' | 'out_for_delivery' | 'delivered' | 'substitution';

export class NotifyService {
  private readonly client: EdgeNotifyClient;

  constructor(client: EdgeNotifyClient) {
    this.client = client;
  }

  public async send(
    customerRef: string,
    blocks: ReplyBlock[],
    reason: NotifyReason,
    traceId?: string | null,
  ): Promise<void> {
    const body = NotifyRequest.parse({
      traceId: traceId ?? randomUUID(),
      customerRef,
      blocks,
      reason,
    });
    await this.client.send(body);
  }
}

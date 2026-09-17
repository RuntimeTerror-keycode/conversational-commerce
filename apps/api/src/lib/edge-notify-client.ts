import { NotifyRequest } from '@cc/contracts';
import { Config } from '../config/config';
import { Logger } from '../logger/logger';

/**
 * Outbound half of the edge <-> api notify contract (docs/contracts.md §A2).
 * The receiving side (POST /notify on apps/edge) already validates
 * X-Service-Token against the same SERVICE_SHARED_SECRET.
 */
export class EdgeNotifyClient {
  private readonly config: Config;
  private readonly logger: Logger;

  constructor(config: Config, logger: Logger) {
    this.config = config;
    this.logger = logger.child('EdgeNotifyClient');
  }

  /** Never throws — a notify failure must not fail the caller's underlying action. */
  public async send(body: NotifyRequest): Promise<void> {
    const url = `${this.config.values.edgeBaseUrl}/notify`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Service-Token': this.config.values.serviceSharedSecret,
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        this.logger.warn('Notify request rejected', { status: res.status, reason: body.reason, traceId: body.traceId });
        return;
      }
      this.logger.info('Notify sent', { reason: body.reason, customerRef: body.customerRef, traceId: body.traceId });
    } catch (err) {
      this.logger.error('Notify request failed', {
        error: err instanceof Error ? err.message : String(err),
        reason: body.reason,
        traceId: body.traceId,
      });
    }
  }
}

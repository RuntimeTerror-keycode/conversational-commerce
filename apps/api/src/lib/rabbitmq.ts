import amqplib, { ChannelModel, Channel, ConsumeMessage, Options } from 'amqplib';
import { Logger } from '../logger/logger';

export class MessageBroker {
  private readonly url: string;
  private readonly logger: Logger;
  private model: ChannelModel | null = null;
  private channel: Channel | null = null;

  constructor(url: string, logger: Logger) {
    this.url = url;
    this.logger = logger.child('MessageBroker');
  }

  /** Connect to RabbitMQ. Safe to call multiple times — returns cached channel. */
  async connect(): Promise<Channel> {
    if (this.channel) return this.channel;

    this.model = await amqplib.connect(this.url);
    this.channel = await this.model.createChannel();

    this.model.on('error', (err: Error) => {
      this.logger.error('Connection error', { error: err.message });
      this.channel = null;
    });

    this.model.on('close', () => {
      this.logger.warn('Connection closed, will reconnect on next use');
      this.model = null;
      this.channel = null;
    });

    this.logger.info('Connected');
    return this.channel;
  }

  /** Get the current channel, reconnecting if needed. */
  async getChannel(): Promise<Channel> {
    if (!this.channel) return this.connect();
    return this.channel;
  }

  /**
   * Publish a JSON message to a queue.
   *
   *   await broker.publish('order.events', { type: 'placed', orderId: 42 });
   */
  async publish(
    queue: string,
    payload: Record<string, unknown>,
    options?: Options.Publish,
  ): Promise<boolean> {
    const ch = await this.getChannel();
    await ch.assertQueue(queue, { durable: true });
    return ch.sendToQueue(
      queue,
      Buffer.from(JSON.stringify(payload)),
      { persistent: true, contentType: 'application/json', ...options },
    );
  }

  /**
   * Subscribe to a queue. Messages are auto-acked on success, nacked on error.
   *
   *   await broker.subscribe('order.events', async (data) => {
   *     console.log(data.type, data.orderId);
   *   });
   */
  async subscribe<T = Record<string, unknown>>(
    queue: string,
    handler: (data: T, msg: ConsumeMessage) => Promise<void>,
    options?: { prefetch?: number },
  ): Promise<void> {
    const ch = await this.getChannel();
    await ch.assertQueue(queue, { durable: true });
    if (options?.prefetch) await ch.prefetch(options.prefetch);

    await ch.consume(queue, async (msg) => {
      if (!msg) return;
      try {
        const data = JSON.parse(msg.content.toString()) as T;
        await handler(data, msg);
        ch.ack(msg);
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        this.logger.error(`Handler error on ${queue}`, { error });
        ch.nack(msg, false, true);
      }
    });

    this.logger.info(`Subscribed to ${queue}`);
  }

  /** Check if RabbitMQ is reachable. */
  async ping(): Promise<boolean> {
    try {
      const ch = await this.getChannel();
      return !!ch;
    } catch {
      return false;
    }
  }

  /** Graceful shutdown. */
  async close(): Promise<void> {
    if (this.channel) await this.channel.close();
    if (this.model) await this.model.close();
    this.channel = null;
    this.model = null;
    this.logger.info('Closed');
  }
}

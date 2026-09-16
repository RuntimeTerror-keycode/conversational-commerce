import { Pool, PoolClient, QueryResult, QueryResultRow } from 'pg';
import { Logger } from '../logger/logger';

export class Database {
  private readonly pool: Pool;
  private readonly logger: Logger;

  constructor(connectionString: string, logger: Logger) {
    this.logger = logger.child('Database');
    this.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    this.pool.on('error', (err) => {
      this.logger.error('Unexpected pool error', { error: err.message });
    });
  }

  /** Run a single query. Acquires and releases a client automatically. */
  async query<T extends QueryResultRow = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    const result = await this.pool.query<T>(text, params);
    const ms = Date.now() - start;
    if (ms > 200) {
      this.logger.warn(`Slow query (${ms}ms)`, { query: text.slice(0, 120) });
    }
    return result;
  }

  /** Acquire a client for manual use. Caller MUST call client.release(). */
  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  /**
   * Run multiple statements inside a transaction.
   *
   *   const result = await db.transaction(async (client) => {
   *     await client.query('INSERT INTO ...', [...]);
   *     await client.query('UPDATE ...', [...]);
   *     return client.query('SELECT ...');
   *   });
   */
  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /** Check if the database is reachable. */
  async ping(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch {
      return false;
    }
  }

  /** Graceful shutdown — call from process exit handler. */
  async close(): Promise<void> {
    await this.pool.end();
    this.logger.info('Pool closed');
  }
}

import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import type { IDatabase, ILogger } from "@cc/domain";

/** IDatabase over a pg.Pool. Mirrors apps/api/src/lib/db.ts. */
export class Database implements IDatabase {
  private readonly pool: Pool;
  private readonly logger: ILogger;

  constructor(connectionString: string, logger: ILogger) {
    this.logger = logger.child("Database");
    this.pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });

    this.pool.on("error", (err) => {
      this.logger.error("Unexpected pool error", { error: err.message });
    });
  }

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

  async getClient(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }
}

import { PoolClient, QueryResult, QueryResultRow } from 'pg';

export interface ILogger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  child(context: string): ILogger;
}

export interface IDatabase {
  query<T extends QueryResultRow = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ): Promise<QueryResult<T>>;
  getClient(): Promise<PoolClient>;
  transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T>;
}

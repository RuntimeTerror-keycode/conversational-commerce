import { PoolClient } from 'pg';
import { IDatabase } from '../types';

export class CategoryRepository {
  private readonly db: IDatabase;

  constructor(db: IDatabase) {
    this.db = db;
  }

  /** Find a category by name (case-insensitive), non-transactional. */
  public async findByName(name: string): Promise<number | null> {
    const result = await this.db.query<{ id: number }>(
      'SELECT id FROM category WHERE LOWER(name) = LOWER($1) LIMIT 1',
      [name],
    );
    return result.rows[0]?.id ?? null;
  }

  /** Find a category by name (case-insensitive) within a transaction. */
  public async findByNameTx(client: PoolClient, name: string): Promise<number | null> {
    const result = await client.query<{ id: number }>(
      'SELECT id FROM category WHERE LOWER(name) = LOWER($1) LIMIT 1',
      [name],
    );
    return result.rows[0]?.id ?? null;
  }

  /** Insert a new category within a transaction and return its id. */
  public async insertTx(client: PoolClient, name: string): Promise<number> {
    const result = await client.query<{ id: number }>(
      'INSERT INTO category (name) VALUES ($1) RETURNING id',
      [name],
    );
    return result.rows[0].id;
  }
}

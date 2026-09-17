import { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// Express
// ---------------------------------------------------------------------------

export type RouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void | Promise<void>;

declare global {
  namespace Express {
    interface Request {
      shopId?: number;
    }
  }
}

// ---------------------------------------------------------------------------
// Health
// ---------------------------------------------------------------------------

export interface HealthResponse {
  status: string;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

export { ErrorCode } from '@cc/domain';

export interface ErrorResponse {
  status: 'error';
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

// ---------------------------------------------------------------------------
// Pagination (shared)
// ---------------------------------------------------------------------------

export interface PageInfo {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  page: PageInfo;
  serverTime: string;
}

// ---------------------------------------------------------------------------
// Feature-specific types
// ---------------------------------------------------------------------------

export * from './identify.types';
export * from './fulfillment.types';
export * from './inventory.types';

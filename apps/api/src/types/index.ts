import { Request, Response, NextFunction } from 'express';

export type RouteHandler = (
  req: Request,
  res: Response,
  next: NextFunction,
) => void | Promise<void>;

export interface HealthResponse {
  status: string;
  timestamp: string;
}

export interface ErrorResponse {
  status: string;
  message: string;
  stack?: string;
}

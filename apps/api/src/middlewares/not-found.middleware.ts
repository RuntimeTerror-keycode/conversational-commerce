import { Request, Response } from 'express';
import { Logger } from '../logger/logger';
import { ErrorResponse } from '../types';

export class NotFoundHandler {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child('NotFoundHandler');
  }

  public handle = (req: Request, res: Response): void => {
    this.logger.warn(`Route not found: ${req.method} ${req.originalUrl}`);

    const response: ErrorResponse = {
      status: 'error',
      message: 'Route not found',
    };

    res.status(404).json(response);
  };
}

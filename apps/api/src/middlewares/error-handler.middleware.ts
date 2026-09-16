import { Request, Response, NextFunction } from 'express';
import { Config } from '../config/config';
import { Logger } from '../logger/logger';
import { ErrorResponse } from '../types';

export class ErrorHandler {
  private readonly logger: Logger;

  constructor(
    private readonly config: Config,
    logger: Logger,
  ) {
    this.logger = logger.child('ErrorHandler');
  }

  public handle = (err: Error, _req: Request, res: Response, _next: NextFunction): void => {
    this.logger.error(err.message, { stack: err.stack });

    const response: ErrorResponse = {
      status: 'error',
      message: err.message || 'Internal Server Error',
    };

    if (this.config.isDevelopment) {
      response.stack = err.stack;
    }

    res.status(500).json(response);
  };
}

import { Request, Response, NextFunction } from 'express';
import { Config } from '../config/config';
import { Logger } from '../logger/logger';
import { AppError } from '../lib/app-error';
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
    if (err instanceof AppError) {
      if (err.statusCode >= 500) {
        this.logger.error(err.message, { code: err.code, stack: err.stack });
      } else {
        this.logger.warn(err.message, { code: err.code });
      }

      const response: ErrorResponse = {
        status: 'error',
        code: err.code,
        message: err.message,
        details: err.details,
      };

      res.status(err.statusCode).json(response);
      return;
    }

    this.logger.error(err.message, { stack: err.stack });

    const response: ErrorResponse = {
      status: 'error',
      code: 'internal_error',
      message: this.config.isDevelopment ? err.message : 'Internal Server Error',
    };

    if (this.config.isDevelopment) {
      response.stack = err.stack;
    }

    res.status(500).json(response);
  };
}

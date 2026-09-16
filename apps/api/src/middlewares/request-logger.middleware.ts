import { Request, Response, NextFunction } from 'express';
import { Logger } from '../logger/logger';

export class RequestLogger {
  private readonly logger: Logger;

  constructor(logger: Logger) {
    this.logger = logger.child('HTTP');
  }

  public handle = (req: Request, res: Response, next: NextFunction): void => {
    const start = process.hrtime.bigint();

    this.logger.info(`--> ${req.method} ${req.originalUrl}`);

    res.on('finish', () => {
      const durationNs = process.hrtime.bigint() - start;
      const durationMs = Number(durationNs) / 1_000_000;

      this.logger.info(`<-- ${req.method} ${req.originalUrl}`, {
        status: res.statusCode,
        durationMs: Math.round(durationMs * 100) / 100,
      });
    });

    next();
  };
}

import { Request, Response, NextFunction } from 'express';
import { AppError } from '@cc/domain';
import { Config } from '../config/config';

/** Protects service-to-service routes (e.g. apps/edge calling in), mirroring apps/edge's X-Service-Token pattern. */
export class ServiceAuthMiddleware {
  private readonly config: Config;

  constructor(config: Config) {
    this.config = config;
  }

  public handle = (req: Request, _res: Response, next: NextFunction): void => {
    const token = req.headers['x-service-token'];

    if (!token || token !== this.config.values.serviceSharedSecret) {
      throw AppError.unauthorized('Invalid or missing X-Service-Token');
    }

    next();
  };
}

import { Request, Response } from 'express';
import { HealthResponse } from '../types';

export class HealthController {
  public check = (_req: Request, res: Response): void => {
    const response: HealthResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };

    res.status(200).json(response);
  };
}

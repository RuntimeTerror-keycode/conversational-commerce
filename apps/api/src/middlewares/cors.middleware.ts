import { Request, Response, NextFunction } from 'express';

export class CorsMiddleware {
  public handle = (req: Request, res: Response, next: NextFunction): void => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Shop-Id');
    res.setHeader('Access-Control-Expose-Headers', 'X-Shop-Id');

    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }

    next();
  };
}

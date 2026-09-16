import { Request, Response } from 'express';

import { IdentifyService } from '../services/identify.service';

export class IdentifyController {
  private readonly service: IdentifyService;

  constructor(service: IdentifyService) {
    this.service = service;
  }

  public identify = async (req: Request, res: Response): Promise<void> => {
    const { username } = req.body as { username?: string };
    const result = await this.service.identify(username as string);
    res.status(200).json(result);
  };
}

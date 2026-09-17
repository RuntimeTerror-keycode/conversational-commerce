import { Request, Response } from 'express';
import { AppError } from '@cc/domain';
import { WhatsappSearchRequest, WhatsappSelectRequest } from '@cc/contracts';
import { WhatsappService } from '../services/whatsapp.service';

export class WhatsappController {
  private readonly service: WhatsappService;

  constructor(service: WhatsappService) {
    this.service = service;
  }

  /** POST /api/whatsapp/orders/search */
  public search = async (req: Request, res: Response): Promise<void> => {
    const parsed = WhatsappSearchRequest.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.badRequest('Invalid request body', { issues: parsed.error.issues });
    }
    const result = await this.service.search(parsed.data);
    res.status(200).json(result);
  };

  /** POST /api/whatsapp/orders/select */
  public select = async (req: Request, res: Response): Promise<void> => {
    const parsed = WhatsappSelectRequest.safeParse(req.body);
    if (!parsed.success) {
      throw AppError.badRequest('Invalid request body', { issues: parsed.error.issues });
    }
    const result = await this.service.select(parsed.data);
    res.status(200).json(result);
  };
}

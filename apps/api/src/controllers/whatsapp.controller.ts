import { Request, Response } from 'express';
import { AppError } from '@cc/domain';
import { WhatsappService } from '../services/whatsapp.service';
import { WhatsappSearchRequest, WhatsappSelectRequest } from '../types';

export class WhatsappController {
  private readonly service: WhatsappService;

  constructor(service: WhatsappService) {
    this.service = service;
  }

  /** POST /api/whatsapp/orders/search */
  public search = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as Partial<WhatsappSearchRequest>;
    if (!body.messageId || !body.customerRef || !body.text || !body.address) {
      throw AppError.badRequest('messageId, customerRef, text and address are required');
    }
    const result = await this.service.search(body as WhatsappSearchRequest);
    res.status(200).json(result);
  };

  /** POST /api/whatsapp/orders/select */
  public select = async (req: Request, res: Response): Promise<void> => {
    const body = req.body as Partial<WhatsappSelectRequest>;
    if (!body.customerRef || body.orderId === undefined || body.productId === undefined) {
      throw AppError.badRequest('customerRef, orderId and productId are required');
    }
    const result = await this.service.select(body as WhatsappSelectRequest);
    res.status(200).json(result);
  };
}

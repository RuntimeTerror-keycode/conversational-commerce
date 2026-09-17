import { ILogger } from '../types';
import { CustomerRepository } from '../repositories/customer.repository';
import { MasterOrderRepository } from '../repositories/master-order.repository';
import { MessageRepository } from '../repositories/message.repository';

export interface EnsureSessionInput {
  addressLine?: string;
  latitude: number;
  longitude: number;
  paymentMode: 'COD' | 'GPAY';
}

export interface SessionResult {
  customerId: number;
  addressId: number;
  orderId: number;
}

/**
 * Resolves a WhatsApp customer's session/draft-order handle. No retailer is
 * known yet at this point in the flow, so this is exempt from the
 * retailerId-first convention every other domain function follows.
 */
export class SessionService {
  private readonly customerRepo: CustomerRepository;
  private readonly masterOrderRepo: MasterOrderRepository;
  private readonly messageRepo: MessageRepository;
  private readonly logger: ILogger;

  constructor(
    customerRepo: CustomerRepository,
    masterOrderRepo: MasterOrderRepository,
    messageRepo: MessageRepository,
    logger: ILogger,
  ) {
    this.customerRepo = customerRepo;
    this.masterOrderRepo = masterOrderRepo;
    this.messageRepo = messageRepo;
    this.logger = logger.child('SessionService');
  }

  public async ensureSession(customerRef: string, input: EnsureSessionInput): Promise<SessionResult> {
    const customer = await this.customerRepo.findOrCreateByPhone(customerRef);
    const addressId = await this.customerRepo.upsertDefaultAddress(customer.id, input);

    let draft = await this.masterOrderRepo.findOpenSessionDraft(customer.id);
    if (!draft) {
      draft = await this.masterOrderRepo.createSessionDraft({
        customerId: customer.id,
        addressId,
        paymentMode: input.paymentMode,
      });
    } else {
      await this.masterOrderRepo.updateSessionDraft(draft.id, addressId, input.paymentMode);
    }

    this.logger.info('Session ensured', { customerRef, orderId: draft.id });

    return { customerId: customer.id, addressId, orderId: draft.id };
  }

  public async logInboundMessage(customerId: number, whatsappMessageId: string, text: string): Promise<void> {
    await this.messageRepo.logInbound(customerId, whatsappMessageId, text);
  }

  /** Ownership check — rejects a customer referencing another customer's orderId. */
  public async findDraftForCustomer(customerRef: string, orderId: number): Promise<{ customerId: number } | null> {
    const customer = await this.customerRepo.findByPhone(customerRef);
    if (!customer) return null;

    const draft = await this.masterOrderRepo.findById(orderId);
    if (!draft || draft.customer_id !== customer.id) return null;

    return { customerId: customer.id };
  }
}

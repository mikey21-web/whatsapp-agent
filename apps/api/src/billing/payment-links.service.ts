import {
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import axios from 'axios';
import type { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { Q_OUTBOUND } from '../queue/queue.module';
import { env } from '../config/env';
import type { Principal } from '../auth/principal';

interface CreatePaymentLinkDto {
  conversationId: string;
  amountInr: number;
  description: string;
  /// Optional reference id (order #, invoice #, etc.) — surfaces in Razorpay dashboard.
  referenceId?: string;
}

@Injectable()
export class PaymentLinksService {
  private readonly logger = new Logger('PaymentLinks');

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway,
    @Inject(Q_OUTBOUND) private readonly outQueue: Queue,
  ) {}

  /**
   * Create a Razorpay payment link, persist an OUTBOUND message containing it,
   * and queue it for delivery to WhatsApp via the standard outbound worker.
   */
  async createAndSend(dto: CreatePaymentLinkDto, p: Principal) {
    if (!env.RAZORPAY_KEY_ID || !env.RAZORPAY_KEY_SECRET) {
      throw new ForbiddenException('Razorpay not configured on this deployment');
    }
    const clientId = clientOf(p);
    const conv = await this.prisma.conversation.findUnique({
      where: { id: dto.conversationId },
      include: { contact: true, whatsappAccount: true, client: true },
    });
    if (!conv || conv.clientId !== clientId) throw new NotFoundException();

    const amountPaise = Math.round(dto.amountInr * 100);
    if (amountPaise < 100) {
      throw new ForbiddenException('Minimum amount is ₹1');
    }

    let response: { id: string; short_url: string; status: string };
    try {
      const res = await axios.post<typeof response>(
        'https://api.razorpay.com/v1/payment_links',
        {
          amount: amountPaise,
          currency: 'INR',
          accept_partial: false,
          description: dto.description,
          customer: {
            name: conv.contact.name ?? undefined,
            contact: conv.contact.phone,
            email: conv.contact.email ?? undefined,
          },
          notify: { sms: false, email: false }, // we send via WhatsApp ourselves
          reminder_enable: true,
          reference_id: dto.referenceId ?? `conv_${conv.id}_${Date.now()}`,
          notes: { conversationId: conv.id, contactId: conv.contactId, clientId },
        },
        {
          auth: { username: env.RAZORPAY_KEY_ID, password: env.RAZORPAY_KEY_SECRET },
          timeout: 15_000,
        },
      );
      response = res.data;
    } catch (e) {
      this.logger.warn(`razorpay payment_link create failed: ${(e as Error).message}`);
      throw new ForbiddenException('Could not create payment link');
    }

    // Persist as an outbound message that gets sent through the normal flow,
    // so guardrails + plan limits + provider abstraction all apply.
    const body = renderPaymentMessage({
      contactName: conv.contact.name,
      amountInr: dto.amountInr,
      description: dto.description,
      shortUrl: response.short_url,
    });

    const msg = await this.prisma.message.create({
      data: {
        conversationId: conv.id,
        direction: 'OUTBOUND',
        type: 'TEXT',
        content: body,
        sentByAgentId: p.type === 'TEAM_MEMBER' ? p.id : null,
      },
    });
    await this.prisma.conversation.update({
      where: { id: conv.id },
      data: { lastMessageAt: msg.createdAt },
    });

    await this.outQueue.add('send', { messageId: msg.id }, { jobId: `out-${msg.id}` });
    this.realtime.emitMessageCreated({
      clientId: conv.clientId,
      conversationId: conv.id,
      message: msg,
    });

    return {
      paymentLinkId: response.id,
      shortUrl: response.short_url,
      status: response.status,
      messageId: msg.id,
    };
  }
}

function renderPaymentMessage(args: {
  contactName: string | null;
  amountInr: number;
  description: string;
  shortUrl: string;
}): string {
  const greet = args.contactName ? `Hi ${args.contactName},` : 'Hi,';
  return [
    greet,
    '',
    `${args.description}`,
    '',
    `Amount: ₹${args.amountInr.toLocaleString('en-IN')}`,
    `Pay securely: ${args.shortUrl}`,
  ].join('\n');
}

function clientOf(p: Principal): string {
  if (p.type === 'CLIENT') return p.id;
  if (p.type === 'TEAM_MEMBER') return p.clientId;
  throw new ForbiddenException();
}

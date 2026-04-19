import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'crypto';

const YK_API = 'https://api.yookassa.ru/v3';

export type YkPaymentResource = {
  id: string;
  status: string;
  paid?: boolean;
  amount?: { value: string; currency: string };
  metadata?: Record<string, string>;
  confirmation?: { type: string; confirmation_url?: string };
};

@Injectable()
export class YookassaApiService {
  private readonly logger = new Logger(YookassaApiService.name);

  isConfigured(): boolean {
    return !!(process.env.YOOKASSA_SHOP_ID && process.env.YOOKASSA_SECRET_KEY);
  }

  private authHeader(): string {
    const shopId = process.env.YOOKASSA_SHOP_ID!;
    const secretKey = process.env.YOOKASSA_SECRET_KEY!;
    return `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString('base64')}`;
  }

  async createRedirectPayment(input: {
    amountValue: string;
    currency: string;
    returnUrl: string;
    description: string;
    metadata: Record<string, string>;
  }): Promise<YkPaymentResource> {
    const idempotenceKey = randomUUID();
    const res = await fetch(`${YK_API}/payments`, {
      method: 'POST',
      headers: {
        Authorization: this.authHeader(),
        'Idempotence-Key': idempotenceKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: { value: input.amountValue, currency: input.currency },
        confirmation: { type: 'redirect', return_url: input.returnUrl },
        capture: true,
        description: input.description,
        metadata: input.metadata,
      }),
    });
    const text = await res.text();
    if (!res.ok) {
      this.logger.warn(`YooKassa create payment failed: ${res.status} ${text}`);
      throw new Error(`YooKassa: ${res.status}`);
    }
    return JSON.parse(text) as YkPaymentResource;
  }

  async getPayment(ykPaymentId: string): Promise<YkPaymentResource> {
    const res = await fetch(`${YK_API}/payments/${ykPaymentId}`, {
      headers: { Authorization: this.authHeader() },
    });
    const text = await res.text();
    if (!res.ok) {
      this.logger.warn(`YooKassa get payment failed: ${res.status} ${text}`);
      throw new Error(`YooKassa get: ${res.status}`);
    }
    return JSON.parse(text) as YkPaymentResource;
  }
}

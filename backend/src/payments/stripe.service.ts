import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly secret = process.env.STRIPE_SECRET_KEY || '';
  private readonly baseUrl = 'https://api.stripe.com/v1';

  private get headers() {
    return {
      Authorization: `Bearer ${this.secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    };
  }

  private encode(params: Record<string, any>): string {
    return Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
      .join('&');
  }

  async createPaymentIntent(amountUSD: number, currency: string, metadata: Record<string, string> = {}) {
    if (!this.secret || this.secret === 'your-stripe-secret-key') {
      throw new BadRequestException('Stripe is not configured. Please contact support.');
    }
    const amountCents = Math.round(amountUSD * 100);
    const body = this.encode({
      amount: amountCents,
      currency: currency.toLowerCase(),
      'metadata[reference]': metadata.reference || '',
      'metadata[user_id]':   metadata.user_id   || '',
      automatic_payment_methods: 'enabled',
    });
    const res = await axios.post(`${this.baseUrl}/payment_intents`, body, { headers: this.headers });
    return { client_secret: res.data.client_secret, payment_intent_id: res.data.id };
  }

  async retrievePaymentIntent(intentId: string) {
    const res = await axios.get(`${this.baseUrl}/payment_intents/${intentId}`, { headers: this.headers });
    return res.data;
  }

  async createPayout(amountUSD: number, currency: string, destination: string) {
    if (!this.secret || this.secret === 'your-stripe-secret-key') {
      throw new BadRequestException('Stripe payouts not configured.');
    }
    const amountCents = Math.round(amountUSD * 100);
    const body = this.encode({
      amount: amountCents,
      currency: currency.toLowerCase(),
      destination,
    });
    const res = await axios.post(`${this.baseUrl}/payouts`, body, { headers: this.headers });
    return res.data;
  }

  isConfigured(): boolean {
    return !!(this.secret && this.secret !== 'your-stripe-secret-key');
  }
}

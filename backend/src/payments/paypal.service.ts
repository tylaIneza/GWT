import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class PayPalService {
  private readonly logger = new Logger(PayPalService.name);
  private readonly clientId     = process.env.PAYPAL_CLIENT_ID     || '';
  private readonly clientSecret = process.env.PAYPAL_CLIENT_SECRET  || '';
  private readonly mode         = process.env.PAYPAL_MODE           || 'sandbox';

  private get baseUrl() {
    return this.mode === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  }

  private async getAccessToken(): Promise<string> {
    const res = await axios.post(
      `${this.baseUrl}/v1/oauth2/token`,
      'grant_type=client_credentials',
      {
        auth: { username: this.clientId, password: this.clientSecret },
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      },
    );
    return res.data.access_token;
  }

  async createOrder(amountUSD: number, currency: string, reference: string, returnUrl: string, cancelUrl: string) {
    if (!this.isConfigured()) {
      throw new BadRequestException('PayPal is not configured. Please contact support.');
    }
    const token = await this.getAccessToken();
    const res = await axios.post(
      `${this.baseUrl}/v2/checkout/orders`,
      {
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: reference,
          amount: {
            currency_code: currency.toUpperCase(),
            value: amountUSD.toFixed(2),
          },
        }],
        application_context: {
          return_url: returnUrl,
          cancel_url: cancelUrl,
          brand_name: 'CodeArena',
          user_action: 'PAY_NOW',
        },
      },
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
    );

    const approvalLink = res.data.links.find((l: any) => l.rel === 'approve');
    return { order_id: res.data.id, approval_url: approvalLink?.href };
  }

  async captureOrder(orderId: string) {
    if (!this.isConfigured()) throw new BadRequestException('PayPal not configured.');
    const token = await this.getAccessToken();
    const res = await axios.post(
      `${this.baseUrl}/v2/checkout/orders/${orderId}/capture`,
      {},
      { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
    );
    const unit   = res.data.purchase_units?.[0];
    const capture = unit?.payments?.captures?.[0];
    return {
      status:    capture?.status,
      amount:    parseFloat(capture?.amount?.value || '0'),
      currency:  capture?.amount?.currency_code,
      reference: unit?.reference_id,
    };
  }

  isConfigured(): boolean {
    return !!(this.clientId && this.clientSecret &&
      this.clientId !== 'your-paypal-client-id' &&
      this.clientSecret !== 'your-paypal-client-secret');
  }
}

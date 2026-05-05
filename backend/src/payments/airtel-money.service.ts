import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { v4 as uuid } from 'uuid';

/**
 * Airtel Money Integration — Rwanda
 * Docs: https://developers.airtel.africa/documentation
 */
@Injectable()
export class AirtelMoneyService {
  private readonly logger   = new Logger(AirtelMoneyService.name);
  private readonly baseUrl  = process.env.AIRTEL_BASE_URL  || 'https://openapi.airtel.africa';
  private readonly clientId = process.env.AIRTEL_CLIENT_ID;
  private readonly secret   = process.env.AIRTEL_CLIENT_SECRET;
  private readonly country  = process.env.AIRTEL_COUNTRY   || 'RW';
  private readonly currency = process.env.AIRTEL_CURRENCY  || 'RWF';

  private tokenCache: { token: string; expiresAt: number } | null = null;

  private async getToken(): Promise<string> {
    if (this.tokenCache && Date.now() < this.tokenCache.expiresAt) {
      return this.tokenCache.token;
    }

    const { data } = await axios.post(
      `${this.baseUrl}/auth/oauth2/token`,
      {
        client_id:     this.clientId,
        client_secret: this.secret,
        grant_type:    'client_credentials',
      },
      { headers: { 'Content-Type': 'application/json' } },
    );

    this.tokenCache = {
      token:     data.access_token,
      expiresAt: Date.now() + (data.expires_in - 60) * 1000,
    };

    return data.access_token;
  }

  /**
   * COLLECT (user pays → platform)
   * Sends a payment request to the user's Airtel number.
   */
  async collect(amount: number, phone: string, reference: string): Promise<string> {
    const token    = await this.getToken();
    const txnId    = uuid();

    try {
      const { data } = await axios.post(
        `${this.baseUrl}/merchant/v2/payments/`,
        {
          reference,
          subscriber: {
            country:  this.country,
            currency: this.currency,
            msisdn:   phone.replace(/\D/g, ''),
          },
          transaction: {
            amount:   String(amount),
            country:  this.country,
            currency: this.currency,
            id:       txnId,
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type':  'application/json',
            'X-Country':     this.country,
            'X-Currency':    this.currency,
          },
        },
      );

      if (data.status?.code !== '200') {
        throw new BadRequestException(data.status?.message || 'Airtel payment failed');
      }

      return txnId;
    } catch (err) {
      this.logger.error('Airtel collect error', err.response?.data);
      throw new BadRequestException('Airtel payment initiation failed');
    }
  }

  /**
   * Get transaction status
   */
  async getTransactionStatus(txnId: string): Promise<{ status: string; code: string }> {
    const token = await this.getToken();
    const { data } = await axios.get(
      `${this.baseUrl}/standard/v1/payments/${txnId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'X-Country':     this.country,
          'X-Currency':    this.currency,
        },
      },
    );
    return {
      status: data.data?.transaction?.status || 'UNKNOWN',
      code:   data.status?.code || '',
    };
  }

  /**
   * DISBURSE (platform pays → user)
   * Sends money to user's Airtel number (prize payout / withdrawal).
   */
  async disburse(amount: number, phone: string, reference: string): Promise<string> {
    const token = await this.getToken();
    const txnId = uuid();

    try {
      const { data } = await axios.post(
        `${this.baseUrl}/standard/v1/disbursements/`,
        {
          payee: {
            msisdn:   phone.replace(/\D/g, ''),
            wallet_type: 'MSISDN',
          },
          reference,
          pin:      process.env.AIRTEL_PIN || '',
          transaction: {
            amount:   String(amount),
            id:       txnId,
            type:     'B2C',
            country:  this.country,
            currency: this.currency,
          },
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type':  'application/json',
            'X-Country':     this.country,
            'X-Currency':    this.currency,
          },
        },
      );

      if (data.status?.code !== '200') {
        throw new BadRequestException(data.status?.message || 'Airtel disbursement failed');
      }

      return txnId;
    } catch (err) {
      this.logger.error('Airtel disburse error', err.response?.data);
      throw new BadRequestException('Airtel disbursement failed');
    }
  }
}

import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import axios from 'axios';
import { v4 as uuid } from 'uuid';

/**
 * MTN MoMo Integration — Rwanda (RWF)
 * Implements: Request to Pay (deposit) + Disbursement (withdraw)
 * Docs: https://momodeveloper.mtn.com
 */
@Injectable()
export class MtnMomoService {
  private readonly logger  = new Logger(MtnMomoService.name);
  private readonly baseUrl = process.env.MTN_BASE_URL  || 'https://sandbox.momodeveloper.mtn.com';
  private readonly subKey  = process.env.MTN_SUBSCRIPTION_KEY;
  private readonly apiUser = process.env.MTN_API_USER;
  private readonly apiKey  = process.env.MTN_API_KEY;
  private readonly env     = process.env.MTN_ENVIRONMENT || 'sandbox';

  /** Generate OAuth token for Collections (deposit) */
  private async getCollectionToken(): Promise<string> {
    const credentials = Buffer.from(`${this.apiUser}:${this.apiKey}`).toString('base64');
    const { data } = await axios.post(
      `${this.baseUrl}/collection/token/`,
      {},
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Ocp-Apim-Subscription-Key': this.subKey,
        },
      },
    );
    return data.access_token;
  }

  /** Generate OAuth token for Disbursements (withdraw) */
  private async getDisbursementToken(): Promise<string> {
    const credentials = Buffer.from(`${this.apiUser}:${this.apiKey}`).toString('base64');
    const { data } = await axios.post(
      `${this.baseUrl}/disbursement/token/`,
      {},
      {
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Ocp-Apim-Subscription-Key': this.subKey,
        },
      },
    );
    return data.access_token;
  }

  /**
   * REQUEST TO PAY (deposit)
   * Prompts the user's MoMo number to confirm payment.
   * Returns a referenceId to poll status.
   */
  async requestToPay(amount: number, phone: string, description: string): Promise<string> {
    const referenceId = uuid();
    const token       = await this.getCollectionToken();

    try {
      await axios.post(
        `${this.baseUrl}/collection/v1_0/requesttopay`,
        {
          amount:      String(amount),
          currency:    'RWF',
          externalId:  uuid(),
          payer: { partyIdType: 'MSISDN', partyId: phone.replace(/\D/g, '') },
          payerMessage: description,
          payeeNote:    description,
        },
        {
          headers: {
            'Authorization':             `Bearer ${token}`,
            'X-Reference-Id':            referenceId,
            'X-Target-Environment':      this.env,
            'Ocp-Apim-Subscription-Key': this.subKey,
            'Content-Type':              'application/json',
          },
        },
      );
    } catch (err) {
      this.logger.error('MTN requestToPay error', err.response?.data);
      throw new BadRequestException('Payment initiation failed');
    }

    return referenceId;
  }

  /**
   * Poll the status of a Request to Pay.
   * status: PENDING | SUCCESSFUL | FAILED
   */
  async getPaymentStatus(referenceId: string): Promise<{ status: string; reason?: string }> {
    const token = await this.getCollectionToken();
    const { data } = await axios.get(
      `${this.baseUrl}/collection/v1_0/requesttopay/${referenceId}`,
      {
        headers: {
          'Authorization':             `Bearer ${token}`,
          'X-Target-Environment':      this.env,
          'Ocp-Apim-Subscription-Key': this.subKey,
        },
      },
    );
    return { status: data.status, reason: data.reason };
  }

  /**
   * DISBURSEMENT (withdraw / prize payout)
   * Sends money to the user's MoMo number.
   */
  async disburse(amount: number, phone: string, note: string): Promise<string> {
    const referenceId = uuid();
    const token       = await this.getDisbursementToken();

    try {
      await axios.post(
        `${this.baseUrl}/disbursement/v1_0/transfer`,
        {
          amount:       String(amount),
          currency:     'RWF',
          externalId:   uuid(),
          payee: { partyIdType: 'MSISDN', partyId: phone.replace(/\D/g, '') },
          payerMessage: note,
          payeeNote:    note,
        },
        {
          headers: {
            'Authorization':             `Bearer ${token}`,
            'X-Reference-Id':            referenceId,
            'X-Target-Environment':      this.env,
            'Ocp-Apim-Subscription-Key': this.subKey,
            'Content-Type':              'application/json',
          },
        },
      );
    } catch (err) {
      this.logger.error('MTN disburse error', err.response?.data);
      throw new BadRequestException('Disbursement failed');
    }

    return referenceId;
  }

  async getDisbursementStatus(referenceId: string): Promise<{ status: string }> {
    const token = await this.getDisbursementToken();
    const { data } = await axios.get(
      `${this.baseUrl}/disbursement/v1_0/transfer/${referenceId}`,
      {
        headers: {
          'Authorization':             `Bearer ${token}`,
          'X-Target-Environment':      this.env,
          'Ocp-Apim-Subscription-Key': this.subKey,
        },
      },
    );
    return { status: data.status };
  }
}

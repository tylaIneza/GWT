import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { v4 as uuid }         from 'uuid';
import { DatabaseService }    from '../database/database.service';
import { WalletService }      from '../wallet/wallet.service';
import { MtnMomoService }     from './mtn-momo.service';
import { AirtelMoneyService } from './airtel-money.service';
import { StripeService }      from './stripe.service';
import { PayPalService }      from './paypal.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private db:     DatabaseService,
    private wallet: WalletService,
    private mtn:    MtnMomoService,
    private airtel: AirtelMoneyService,
    private stripe: StripeService,
    private paypal: PayPalService,
  ) {}

  // ─── Mobile Money ────────────────────────────────────────────
  async initiateDeposit(userId: string, amount: number, phone: string, provider: 'mtn'|'airtel') {
    if (amount < 500)     throw new BadRequestException('Minimum deposit is 500 RWF');
    if (amount > 1000000) throw new BadRequestException('Maximum deposit is 1,000,000 RWF');

    const reference = `DEP-${uuid()}`;
    let providerRef: string;

    if (provider === 'mtn') {
      providerRef = await this.mtn.requestToPay(amount, phone, `Deposit: ${reference}`);
    } else {
      providerRef = await this.airtel.collect(amount, phone, reference);
    }

    const w = await this.wallet.getWallet(userId);
    await this.db.execute(
      `INSERT INTO transactions
         (id, wallet_id, user_id, type, amount, currency, balance_before, balance_after, status, reference, payment_provider, provider_reference)
       VALUES (?,?,?,'deposit',?,?,?,?,'pending',?,?,?)`,
      [uuid(), w.id, userId, amount, 'RWF', w.balance, w.balance, reference, provider, providerRef],
    );

    return { reference, provider_ref: providerRef, message: 'Check your phone to confirm payment' };
  }

  async checkAndCreditDeposit(reference: string, userId: string) {
    const txn = await this.db.queryOne(
      `SELECT * FROM transactions WHERE reference = ? AND user_id = ? AND status = 'pending'`,
      [reference, userId],
    );
    if (!txn) throw new BadRequestException('Transaction not found or already processed');

    let providerStatus: string;
    if (txn.payment_provider === 'mtn') {
      const s = await this.mtn.getPaymentStatus(txn.provider_reference);
      providerStatus = s.status;
    } else {
      const s = await this.airtel.getTransactionStatus(txn.provider_reference);
      providerStatus = s.status;
    }

    if (providerStatus === 'SUCCESSFUL' || providerStatus === 'SUCCESS') {
      await this.wallet.credit(userId, parseFloat(txn.amount), 'deposit', txn.reference, txn.payment_provider, txn.provider_reference);
      await this.db.execute(`UPDATE transactions SET status = 'reversed' WHERE reference = ?`, [reference]);
      return { status: 'credited', amount: txn.amount };
    }

    if (providerStatus === 'FAILED' || providerStatus === 'FAILURE') {
      await this.db.execute(`UPDATE transactions SET status = 'failed' WHERE reference = ?`, [reference]);
      return { status: 'failed' };
    }

    return { status: 'pending' };
  }

  async initiateWithdrawal(userId: string, amount: number, phone: string, provider: 'mtn'|'airtel') {
    if (amount < 1000) throw new BadRequestException('Minimum withdrawal is 1,000 RWF');
    const reference = `WD-${uuid()}`;

    return this.db.transaction(async (conn) => {
      await this.wallet.debit(userId, amount, 'withdrawal', reference, provider, null, {}, conn);
      let providerRef: string;
      try {
        if (provider === 'mtn') {
          providerRef = await this.mtn.disburse(amount, phone, reference);
        } else {
          providerRef = await this.airtel.disburse(amount, phone, reference);
        }
      } catch (err) {
        await this.wallet.credit(userId, amount, 'refund', `REF-${reference}`, 'internal', null, { reason: 'disbursement_failed' }, conn);
        throw err;
      }
      return { reference, provider_ref: providerRef, message: 'Withdrawal initiated' };
    });
  }

  // ─── Stripe ─────────────────────────────────────────────────
  async createStripeDeposit(userId: string, amountUSD: number, currency: string, _cardDetails: any) {
    if (amountUSD < 5)     throw new BadRequestException('Minimum deposit is $5');
    if (amountUSD > 10000) throw new BadRequestException('Maximum deposit is $10,000');

    const reference = `STRIPE-DEP-${uuid()}`;
    const intent = await this.stripe.createPaymentIntent(amountUSD, currency, {
      reference, user_id: userId,
    });

    const w = await this.wallet.getWallet(userId);
    await this.db.execute(
      `INSERT INTO transactions
         (id, wallet_id, user_id, type, amount, currency, balance_before, balance_after, status, reference, payment_provider, provider_reference, metadata)
       VALUES (?,?,?,'deposit',?,?,?,?,'pending',?,'stripe',?,?)`,
      [uuid(), w.id, userId, amountUSD, currency, w.balance, w.balance,
       reference, intent.payment_intent_id, JSON.stringify({ client_secret: intent.client_secret })],
    );

    return { reference, client_secret: intent.client_secret, message: 'Complete payment with Stripe' };
  }

  async confirmStripeDeposit(userId: string, paymentIntentId: string) {
    const intent = await this.stripe.retrievePaymentIntent(paymentIntentId);
    if (intent.status !== 'succeeded') {
      return { status: 'pending', stripe_status: intent.status };
    }

    const txn = await this.db.queryOne(
      `SELECT * FROM transactions WHERE provider_reference = ? AND user_id = ? AND status = 'pending'`,
      [paymentIntentId, userId],
    );
    if (!txn) return { status: 'already_processed' };

    const amount   = intent.amount / 100;
    const currency = intent.currency.toUpperCase();
    await this.wallet.credit(userId, amount, 'deposit', txn.reference, 'stripe', paymentIntentId, { currency });
    await this.db.execute(
      `UPDATE transactions SET status = 'completed', currency = ? WHERE provider_reference = ?`,
      [currency, paymentIntentId],
    );
    return { status: 'credited', amount, currency };
  }

  // ─── PayPal ──────────────────────────────────────────────────
  async createPayPalDeposit(userId: string, amountUSD: number, currency: string, frontendUrl: string) {
    if (amountUSD < 5) throw new BadRequestException('Minimum deposit is $5');

    const reference = `PP-DEP-${uuid()}`;
    const returnUrl = `${frontendUrl}/wallet?paypal=success&ref=${reference}`;
    const cancelUrl = `${frontendUrl}/wallet?paypal=cancel`;

    const order = await this.paypal.createOrder(amountUSD, currency, reference, returnUrl, cancelUrl);

    const w = await this.wallet.getWallet(userId);
    await this.db.execute(
      `INSERT INTO transactions
         (id, wallet_id, user_id, type, amount, currency, balance_before, balance_after, status, reference, payment_provider, provider_reference)
       VALUES (?,?,?,'deposit',?,?,?,?,'pending',?,'paypal',?)`,
      [uuid(), w.id, userId, amountUSD, currency, w.balance, w.balance, reference, order.order_id],
    );

    return { reference, approval_url: order.approval_url, order_id: order.order_id };
  }

  async capturePayPalDeposit(userId: string, orderId: string) {
    const result = await this.paypal.captureOrder(orderId);
    if (result.status !== 'COMPLETED') return { status: 'pending' };

    const txn = await this.db.queryOne(
      `SELECT * FROM transactions WHERE provider_reference = ? AND user_id = ? AND status = 'pending'`,
      [orderId, userId],
    );
    if (!txn) return { status: 'already_processed' };

    await this.wallet.credit(userId, result.amount, 'deposit', txn.reference, 'paypal', orderId, { currency: result.currency });
    await this.db.execute(
      `UPDATE transactions SET status = 'completed' WHERE provider_reference = ?`, [orderId],
    );
    return { status: 'credited', amount: result.amount, currency: result.currency };
  }
}

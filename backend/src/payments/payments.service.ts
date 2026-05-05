import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService }    from '../database/database.service';
import { WalletService }      from '../wallet/wallet.service';
import { MtnMomoService }     from './mtn-momo.service';
import { AirtelMoneyService } from './airtel-money.service';
import { v4 as uuid }         from 'uuid';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private db:      DatabaseService,
    private wallet:  WalletService,
    private mtn:     MtnMomoService,
    private airtel:  AirtelMoneyService,
  ) {}

  async initiateDeposit(userId: string, amount: number, phone: string, provider: 'mtn' | 'airtel') {
    if (amount < 500)  throw new BadRequestException('Minimum deposit is 500 RWF');
    if (amount > 1000000) throw new BadRequestException('Maximum deposit is 1,000,000 RWF');

    const reference = `DEP-${uuid()}`;
    let providerRef: string;

    if (provider === 'mtn') {
      providerRef = await this.mtn.requestToPay(amount, phone, `Deposit to CodePlatform: ${reference}`);
    } else {
      providerRef = await this.airtel.collect(amount, phone, reference);
    }

    // Store pending transaction
    const wallet = await this.wallet.getWallet(userId);
    await this.db.query(
      `INSERT INTO transactions
         (wallet_id, user_id, type, amount, balance_before, balance_after, status, reference, payment_provider, provider_reference)
       VALUES ($1,$2,'deposit',$3,$4,$4,'pending',$5,$6,$7)`,
      [wallet.id, userId, amount, wallet.balance, reference, provider, providerRef],
    );

    return { reference, provider_ref: providerRef, message: 'Check your phone to confirm payment' };
  }

  async checkAndCreditDeposit(reference: string, userId: string) {
    const txn = await this.db.queryOne(
      `SELECT * FROM transactions WHERE reference = $1 AND user_id = $2 AND status = 'pending'`,
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
      await this.wallet.credit(
        userId, parseFloat(txn.amount), 'deposit', txn.reference,
        txn.payment_provider, txn.provider_reference,
      );
      await this.db.query(
        `UPDATE transactions SET status = 'reversed' WHERE reference = $1`, [reference],
      );
      return { status: 'credited', amount: txn.amount };
    }

    if (providerStatus === 'FAILED' || providerStatus === 'FAILURE') {
      await this.db.query(`UPDATE transactions SET status = 'failed' WHERE reference = $1`, [reference]);
      return { status: 'failed' };
    }

    return { status: 'pending' };
  }

  async initiateWithdrawal(userId: string, amount: number, phone: string, provider: 'mtn' | 'airtel') {
    if (amount < 1000) throw new BadRequestException('Minimum withdrawal is 1,000 RWF');

    const reference = `WD-${uuid()}`;

    return this.db.transaction(async (client) => {
      // Debit first (atomic)
      await this.wallet.debit(userId, amount, 'withdrawal', reference, provider, null, {}, client);

      // Then send money
      let providerRef: string;
      try {
        if (provider === 'mtn') {
          providerRef = await this.mtn.disburse(amount, phone, reference);
        } else {
          providerRef = await this.airtel.disburse(amount, phone, reference);
        }
      } catch (err) {
        // If disbursement fails, refund immediately
        await this.wallet.credit(userId, amount, 'refund', `REF-${reference}`, 'internal', null, { reason: 'disbursement_failed' }, client);
        throw err;
      }

      return { reference, provider_ref: providerRef, message: 'Withdrawal initiated' };
    });
  }
}

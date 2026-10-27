// Fakes of the payout ports, for unit tests of balances and payouts.
import type { CurrencyBalance, Payout, PayoutAccount, PayoutAdminStore, PayoutStore, RecordPayoutInput, SchoolBalances } from "../commerce";

/** In-memory `PayoutStore` that answers with set balances and records the hold cutoff it was asked with. */
export class FakePayoutStore implements PayoutStore {
  balanceRows: CurrencyBalance[] = [];
  payouts: Payout[] = [];
  account: PayoutAccount | null = null;
  lastCutoff: Date | null = null;

  /**
   * Records the cutoff and answers with `balanceRows`.
   *
   * @param payableBefore The hold cutoff.
   * @returns `balanceRows`.
   */
  async balances(payableBefore: Date) {
    this.lastCutoff = payableBefore;
    return this.balanceRows;
  }

  /**
   * Lists the payouts.
   *
   * @returns `payouts`.
   */
  async listPayouts() {
    return this.payouts;
  }

  /**
   * Reads the payout details.
   *
   * @returns `account`.
   */
  async findPayoutAccount() {
    return this.account;
  }

  /**
   * Saves the payout details.
   *
   * @param account The details.
   * @returns The details.
   */
  async savePayoutAccount(account: PayoutAccount) {
    this.account = account;
    return account;
  }
}

/** In-memory `PayoutAdminStore` over set schools: records payouts that fit the available balance. */
export class FakePayoutAdminStore implements PayoutAdminStore {
  schools: SchoolBalances[] = [];
  readonly recorded: (RecordPayoutInput & { recordedById: string })[] = [];

  /**
   * Lists the schools' balances.
   *
   * @returns `schools`.
   */
  async listBalances() {
    return this.schools;
  }

  /**
   * Records a payout that fits the school's available balance.
   *
   * @param payout The payout.
   * @param _payableBefore The hold cutoff; the set balances already account for it.
   * @param recordedById The admin recording it.
   * @returns The payout, or null when it does not fit.
   */
  async recordPayout(payout: RecordPayoutInput, _payableBefore: Date, recordedById: string) {
    const balance = this.schools.find(({ school }) => school.id === payout.schoolId)?.balances.find(({ currency }) => currency === payout.currency);
    if (!balance || payout.amount > balance.available) return null;
    this.recorded.push({ ...payout, recordedById });
    return { id: `payout-${this.recorded.length}`, currency: payout.currency, amount: payout.amount, paidAt: payout.paidAt, reference: payout.reference };
  }
}

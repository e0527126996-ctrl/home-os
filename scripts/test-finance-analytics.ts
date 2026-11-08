import assert from 'node:assert/strict';
import { buildFinanceAnalytics } from '../src/lib/financeAnalytics.ts';
import type { FinancialAccount, LedgerTransaction } from '../src/types.ts';

const timestamp = '2026-11-08T12:00:00.000Z';
const makeAccount = (id: string, currency: FinancialAccount['currency'] = 'ILS'): FinancialAccount => ({
  id,
  householdId: 'household_test',
  name: id,
  type: 'CHECKING',
  institution: 'Test Bank',
  currency,
  openingBalanceCents: 0,
  openingBalance: 0,
  currentBalanceCents: 0,
  currentBalance: 0,
  status: 'ACTIVE',
  isLiability: false,
  createdAt: timestamp,
  updatedAt: timestamp,
});

const makeTransaction = (
  id: string,
  accountId: string,
  date: string,
  amountCents: number,
  type: LedgerTransaction['type'] = 'EXPENSE',
  verificationStatus: LedgerTransaction['verificationStatus'] = 'VERIFIED',
  category = 'בדיקה',
): LedgerTransaction => ({
  id,
  householdId: 'household_test',
  accountId,
  date,
  amountCents,
  type,
  category,
  payee: 'בדיקת מערכת',
  source: 'MANUAL',
  verificationStatus,
  createdAt: timestamp,
  updatedAt: timestamp,
  createdBy: 'test_user',
});

const cases: Array<{ name: string; run: () => void }> = [
  {
    name: 'excludes pending transactions from verified analytics but reports their ILS amount',
    run: () => {
      const ils = makeAccount('ils');
      const transactions = [
        makeTransaction('verified', 'ils', '2026-11-02', 30000, 'INCOME', 'VERIFIED'),
        makeTransaction('pending', 'ils', '2026-11-03', 12000, 'EXPENSE', 'PENDING'),
        makeTransaction('transfer', 'ils', '2026-11-04', 5000, 'TRANSFER', 'VERIFIED'),
      ];
      const result = buildFinanceAnalytics([ils], transactions, new Date(timestamp));
      assert.equal(result.verifiedTransactions.length, 1);
      assert.equal(result.pendingTransactions.length, 1);
      assert.equal(result.pendingAmountIlsCents, 12000);
      assert.equal(result.currentMonth.incomeCents, 30000);
      assert.equal(result.currentMonth.expenseCents, 0);
    },
  },
  {
    name: 'keeps foreign-currency activity separate from ILS monthly charts',
    run: () => {
      const ils = makeAccount('ils');
      const usd = makeAccount('usd', 'USD');
      const transactions = [
        makeTransaction('ils-income', 'ils', '2026-11-02', 100000, 'INCOME'),
        makeTransaction('ils-expense', 'ils', '2026-11-03', 40000, 'EXPENSE'),
        makeTransaction('usd-income', 'usd', '2026-11-04', 25000, 'INCOME'),
      ];
      const result = buildFinanceAnalytics([ils, usd], transactions, new Date(timestamp));
      assert.equal(result.currentMonth.incomeCents, 100000);
      assert.equal(result.currentMonth.expenseCents, 40000);
      assert.equal(result.categories.find(([name]) => name === 'בדיקה')?.[1], 40000);
      assert.deepEqual(result.foreignCurrencySummaries, [
        { currency: 'USD', incomeCents: 25000, expenseCents: 0, count: 1 },
      ]);
    },
  },
  {
    name: 'enables three-month forecast only with activity in each complete month',
    run: () => {
      const ils = makeAccount('ils');
      const transactions: LedgerTransaction[] = [];
      for (const month of ['08', '09', '10']) {
        transactions.push(
          makeTransaction('income-a-' + month, 'ils', '2026-' + month + '-05', 50000, 'INCOME'),
          makeTransaction('income-b-' + month, 'ils', '2026-' + month + '-15', 50000, 'INCOME'),
          makeTransaction('expense-' + month, 'ils', '2026-' + month + '-25', 20000, 'EXPENSE'),
        );
      }
      for (const day of ['01', '02', '03', '04', '05']) {
        transactions.push(
          makeTransaction('current-' + day, 'ils', '2026-11-' + day, 10000, 'EXPENSE'),
        );
      }
      const result = buildFinanceAnalytics([ils], transactions, new Date(timestamp));
      assert.equal(result.forecast.available, true);
      assert.equal(result.forecast.historyMonths, 3);
      assert.equal(result.forecast.historyTransactions, 9);
      assert.equal(result.forecast.averageIncomeCents, 100000);
      assert.equal(result.forecast.averageExpenseCents, 20000);
      assert.equal(result.forecast.horizons.find(item => item.months === 3)?.netCents, 240000);
      assert.equal(result.projectionReady, true);
    },
  },
  {
    name: 'keeps every forecast horizon at zero when verified history is incomplete',
    run: () => {
      const ils = makeAccount('ils');
      const transactions = [
        makeTransaction('oct-income', 'ils', '2026-10-05', 180000, 'INCOME'),
        makeTransaction('oct-expense-a', 'ils', '2026-10-12', 60000, 'EXPENSE'),
        makeTransaction('oct-expense-b', 'ils', '2026-10-22', 40000, 'EXPENSE'),
      ];
      const result = buildFinanceAnalytics([ils], transactions, new Date(timestamp));
      assert.equal(result.forecast.available, false);
      assert.deepEqual(
        result.forecast.horizons.map(item => [item.incomeCents, item.expenseCents, item.netCents]),
        [[0, 0, 0], [0, 0, 0], [0, 0, 0]],
      );
      assert.ok(result.forecast.monthly.every(item => item.incomeCents === 0 && item.expenseCents === 0 && item.netCents === 0));
    },
  },
];

let failed = 0;
for (const testCase of cases) {
  try {
    testCase.run();
    process.stdout.write('✓ ' + testCase.name + '\n');
  } catch (error) {
    failed += 1;
    process.stderr.write('✗ ' + testCase.name + '\n');
    process.stderr.write(String(error) + '\n');
  }
}
process.stdout.write('\n' + (cases.length - failed) + '/' + cases.length + ' finance analytics tests passed\n');
if (failed > 0) process.exitCode = 1;

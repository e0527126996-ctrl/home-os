import { FinancialAccount, LedgerTransaction } from '../types.ts';

export interface FinanceMonth {
  key: string;
  label: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  transactionCount: number;
}

export interface FinanceForecast {
  available: boolean;
  confidence: 'low' | 'moderate' | 'good';
  historyMonths: number;
  historyTransactions: number;
  averageIncomeCents: number;
  averageExpenseCents: number;
  averageNetCents: number;
  horizons: Array<{
    months: 3 | 6 | 12;
    incomeCents: number;
    expenseCents: number;
    netCents: number;
  }>;
  monthly: Array<{
    key: string;
    label: string;
    incomeCents: number;
    expenseCents: number;
    netCents: number;
    cumulativeNetCents: number;
  }>;
}

export interface FinanceAnalytics {
  verifiedTransactions: LedgerTransaction[];
  pendingTransactions: LedgerTransaction[];
  months: FinanceMonth[];
  currentMonth: FinanceMonth;
  previousMonth: FinanceMonth;
  categories: Array<[string, number]>;
  pendingAmountIlsCents: number;
  foreignCurrencySummaries: Array<{ currency: string; incomeCents: number; expenseCents: number; count: number }>;
  forecast: FinanceForecast;
  projectionReady: boolean;
  spendingAlerts: Array<{
    category: string;
    currentAmount: number;
    projected: number;
    historicalAverage: number;
    historicalMonthsPresent: number;
    increase: number;
    transactionCount: number;
  }>;
}

const monthKey = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
const monthLabel = (date: Date) => new Intl.DateTimeFormat('he-IL', { month: 'short' }).format(date);
const safeAmount = (tx: LedgerTransaction) => Number.isSafeInteger(tx.amountCents) && tx.amountCents > 0 ? tx.amountCents : 0;

export function buildFinanceAnalytics(
  accounts: FinancialAccount[],
  transactions: LedgerTransaction[],
  now = new Date(),
): FinanceAnalytics {
  const currencies = new Map(accounts.map(account => [account.id, account.currency]));
  const verifiedTransactions = transactions.filter(tx =>
    tx.verificationStatus !== 'PENDING' &&
    (tx.type === 'INCOME' || tx.type === 'EXPENSE') &&
    safeAmount(tx) > 0 &&
    Boolean(currencies.get(tx.accountId)),
  );
  const pendingTransactions = transactions.filter(tx => tx.verificationStatus === 'PENDING');
  const ilsVerified = verifiedTransactions.filter(tx => currencies.get(tx.accountId) === 'ILS');
  const currentKey = monthKey(now);
  const previousDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousKey = monthKey(previousDate);

  const months: FinanceMonth[] = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
    const key = monthKey(date);
    const monthTransactions = ilsVerified.filter(tx => tx.date?.slice(0, 7) === key);
    const incomeCents = monthTransactions.filter(tx => tx.type === 'INCOME').reduce((sum, tx) => sum + safeAmount(tx), 0);
    const expenseCents = monthTransactions.filter(tx => tx.type === 'EXPENSE').reduce((sum, tx) => sum + safeAmount(tx), 0);
    return { key, label: monthLabel(date), incomeCents, expenseCents, netCents: incomeCents - expenseCents, transactionCount: monthTransactions.length };
  });

  const currentMonth = months.find(month => month.key === currentKey) || { key: currentKey, label: monthLabel(now), incomeCents: 0, expenseCents: 0, netCents: 0, transactionCount: 0 };
  const previousMonth = months.find(month => month.key === previousKey) || { key: previousKey, label: monthLabel(previousDate), incomeCents: 0, expenseCents: 0, netCents: 0, transactionCount: 0 };

  const categoriesMap = new Map<string, number>();
  for (const tx of ilsVerified) {
    if (tx.type !== 'EXPENSE' || tx.date?.slice(0, 7) !== currentKey) continue;
    const category = tx.category?.trim() || 'ללא קטגוריה';
    categoriesMap.set(category, (categoriesMap.get(category) || 0) + safeAmount(tx));
  }

  const foreignMap = new Map<string, { incomeCents: number; expenseCents: number; count: number }>();
  for (const tx of verifiedTransactions) {
    const currency = currencies.get(tx.accountId);
    if (!currency || currency === 'ILS' || tx.date?.slice(0, 7) !== currentKey) continue;
    const value = foreignMap.get(currency) || { incomeCents: 0, expenseCents: 0, count: 0 };
    if (tx.type === 'INCOME') value.incomeCents += safeAmount(tx);
    else value.expenseCents += safeAmount(tx);
    value.count += 1;
    foreignMap.set(currency, value);
  }

  // Forecasts use the three complete calendar months before the current month.
  // A forecast is withheld unless all three months contain verified activity.
  const currentMonthTransactions = ilsVerified.filter(tx =>
    tx.date?.slice(0, 7) === currentKey && (tx.type === 'INCOME' || tx.type === 'EXPENSE')
  );
  const currentTransactionDays = new Set(currentMonthTransactions.map(tx => tx.date)).size;
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projectionReady = now.getDate() >= 3 && currentTransactionDays >= 3 && currentMonthTransactions.length >= 5;

  const history = months.filter(month => month.key < currentKey).slice(-3);
  const historyTransactions = history.reduce((sum, month) => sum + month.transactionCount, 0);
  const historyMonthsWithActivity = history.filter(month => month.transactionCount > 0).length;
  const available = history.length === 3 && historyMonthsWithActivity === 3 && historyTransactions >= 9;
  const divisor = Math.max(1, history.length);
  const averageIncomeCents = Math.round(history.reduce((sum, month) => sum + month.incomeCents, 0) / divisor);
  const averageExpenseCents = Math.round(history.reduce((sum, month) => sum + month.expenseCents, 0) / divisor);
  const averageNetCents = averageIncomeCents - averageExpenseCents;
  const confidence: FinanceForecast['confidence'] = !available ? 'low' : historyTransactions >= 30 ? 'good' : 'moderate';

  const monthly = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(now.getFullYear(), now.getMonth() + index + 1, 1);
    const incomeCents = available ? averageIncomeCents : 0;
    const expenseCents = available ? averageExpenseCents : 0;
    const netCents = incomeCents - expenseCents;
    return { key: monthKey(date), label: monthLabel(date), incomeCents, expenseCents, netCents, cumulativeNetCents: netCents * (index + 1) };
  });

  // Keep every forecast surface fail-closed: unavailable history must never
  // produce plausible-looking horizon totals from a partial sample.
  const horizons = ([3, 6, 12] as const).map(monthsCount => ({
    months: monthsCount,
    incomeCents: available ? averageIncomeCents * monthsCount : 0,
    expenseCents: available ? averageExpenseCents * monthsCount : 0,
    netCents: available ? averageNetCents * monthsCount : 0,
  }));

  // Shared category run-rate alerts. These are review prompts, not guarantees.
  const spendingAlerts = projectionReady && history.length === 3
    ? [...categoriesMap.entries()].map(([category, currentAmount]) => {
        const categoryTransactions = currentMonthTransactions.filter(tx =>
          tx.type === 'EXPENSE' && (tx.category?.trim() || 'ללא קטגוריה') === category
        );
        const historyAmounts = history.map(month => ilsVerified
          .filter(tx => tx.type === 'EXPENSE' && tx.date?.slice(0, 7) === month.key && (tx.category?.trim() || 'ללא קטגוריה') === category)
          .reduce((sum, tx) => sum + safeAmount(tx), 0)
        );
        const historicalTotal = historyAmounts.reduce((sum, value) => sum + value, 0);
        const historicalMonthsPresent = historyAmounts.filter(value => value > 0).length;
        const historicalAverage = historicalTotal / 3;
        const projected = Math.round(currentAmount * daysInMonth / Math.max(1, now.getDate()));
        const increase = projected - historicalAverage;
        return { category, currentAmount, projected, historicalAverage, historicalMonthsPresent, increase, transactionCount: categoryTransactions.length };
      })
      .filter(item => item.transactionCount >= 2 && item.historicalMonthsPresent >= 2 && item.historicalAverage > 0 && item.increase >= 5000 && item.projected >= item.historicalAverage * 1.2)
      .sort((a, b) => b.increase - a.increase)
      .slice(0, 3)
    : [];

  return {
    verifiedTransactions,
    pendingTransactions,
    months,
    currentMonth,
    previousMonth,
    categories: [...categoriesMap.entries()].sort((a, b) => b[1] - a[1]),
    pendingAmountIlsCents: pendingTransactions
      .filter(tx => currencies.get(tx.accountId) === 'ILS')
      .reduce((sum, tx) => sum + safeAmount(tx), 0),
    foreignCurrencySummaries: [...foreignMap.entries()].map(([currency, value]) => ({ currency, ...value })).sort((a, b) => a.currency.localeCompare(b.currency)),
    forecast: { available, confidence, historyMonths: historyMonthsWithActivity, historyTransactions, averageIncomeCents, averageExpenseCents, averageNetCents, horizons, monthly },
    projectionReady,
    spendingAlerts,
  };
}

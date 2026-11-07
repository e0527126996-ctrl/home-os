
import React, { useState, useMemo } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  ArrowLeftRight,
  Plus,
  Search,
  Trash2,
  Edit2,
  CheckCircle2,
  Clock,
  FileSpreadsheet,
  AlertTriangle,
} from 'lucide-react';
import {
  FinancialAccount,
  LedgerTransaction,
  TransactionType,
} from '../types.ts';
import { ThemeConfig } from '../lib/themes.ts';
import { formatCents } from '../lib/currency.ts';
import { buildFinanceAnalytics } from '../lib/financeAnalytics.ts';
import { WorkspacePageHeader } from './WorkspacePageHeader.tsx';

// Imported legacy rows can occasionally contain Markdown table syntax instead of plain cell text.
// Normalize only the presentation layer; never mutate the stored transaction or its audit trail.
const displayLedgerText = (value: string | undefined | null): string => {
  const raw = String(value ?? '').trim();
  if (!raw) return '—';
  const lines = raw.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const isMarkdownTable = lines.some(line => /^\|/.test(line)) && lines.some(line => /^\|?\s*:?-{3,}/.test(line));
  const cleanCell = (cell: string) => cell
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
  if (isMarkdownTable) {
    const cells = lines
      .filter(line => !/^\|?\s*:?-{3,}/.test(line))
      .flatMap(line => line.replace(/^\|/, '').replace(/\|$/, '').split('|'))
      .map(cleanCell)
      .filter(Boolean);
    if (cells.length) return cells.join(' · ');
  }
  return cleanCell(raw);
};

interface TransactionsLedgerViewProps {
  transactions: LedgerTransaction[];
  accounts: FinancialAccount[];
  activeTheme: ThemeConfig;
  canEdit: boolean;
  onAddTransaction: () => void;
  onAddTransfer: () => void;
  onEditTransaction: (tx: LedgerTransaction) => void;
  onDeleteTransaction: (txId: string) => Promise<void>;
  selectedAccountId?: string | null;
  onSelectAccount?: (accId: string | null) => void;
}

export const TransactionsLedgerView: React.FC<TransactionsLedgerViewProps> = ({
  transactions,
  accounts,
  activeTheme,
  canEdit,
  onAddTransaction,
  onAddTransfer,
  onEditTransaction,
  onDeleteTransaction,
  selectedAccountId,
  onSelectAccount,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [accountFilter, setAccountFilter] = useState<string>(
    selectedAccountId || 'ALL'
  );
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [dateFilter, setDateFilter] = useState<
    'ALL' | 'THIS_MONTH' | 'LAST_MONTH'
  >('ALL');
  const [reviewFilter, setReviewFilter] = useState<'ALL' | 'PENDING' | 'UNCATEGORIZED' | 'RECONCILED'>('ALL');
  const [deletingTx, setDeletingTx] = useState<LedgerTransaction | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  // מיפוי חשבונות לצורך הצגת שמות
  const accountsMap = useMemo(() => {
    const map = new Map<string, FinancialAccount>();
    accounts.forEach((a) => map.set(a.id, a));
    return map;
  }, [accounts]);

  // קטגוריות ייחודיות לסינון
  const uniqueCategories = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((tx) => {
      if (tx.category) set.add(tx.category);
    });
    return Array.from(set).sort();
  }, [transactions]);

  // Use the same verified-transaction rules as the dashboard and home finance view.
  const financeAnalytics = useMemo(() => buildFinanceAnalytics(accounts, transactions), [accounts, transactions]);
  const summary = useMemo(() => {
    let incomeCents = 0;
    let expenseCents = 0;
    let transferVolumeCents = 0;
    const confirmedIlsTransactions = financeAnalytics.verifiedTransactions.filter(tx =>
      accountsMap.get(tx.accountId)?.currency === 'ILS'
    );

    confirmedIlsTransactions.forEach((tx) => {
      if (tx.type === 'INCOME') incomeCents += tx.amountCents;
      else if (tx.type === 'EXPENSE') expenseCents += tx.amountCents;
    });
    const verifiedTransfers = transactions.filter(tx =>
      tx.type === 'TRANSFER' &&
      tx.verificationStatus !== 'PENDING' &&
      accountsMap.get(tx.accountId)?.currency === 'ILS' &&
      Number.isSafeInteger(tx.amountCents) &&
      tx.amountCents > 0
    );
    verifiedTransfers.forEach(tx => {
      if (tx.transferDirection === 'OUT') transferVolumeCents += tx.amountCents;
    });

    return {
      incomeCents,
      expenseCents,
      netCashflowCents: incomeCents - expenseCents,
      transferVolumeCents,
      count: confirmedIlsTransactions.length + verifiedTransfers.length,
    };
  }, [financeAnalytics, transactions, accountsMap]);

  // גבולות תאריכים לסינון
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const thisMonthPrefix = `${currentYear}-${String(
    currentMonth + 1
  ).padStart(2, '0')}`;

  const lastMonthDate = new Date(currentYear, currentMonth - 1, 1);

  const lastMonthPrefix = `${lastMonthDate.getFullYear()}-${String(
    lastMonthDate.getMonth() + 1
  ).padStart(2, '0')}`;

  // סינון עסקאות
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      if (accountFilter !== 'ALL' && tx.accountId !== accountFilter) {
        return false;
      }

      if (typeFilter !== 'ALL' && tx.type !== typeFilter) {
        return false;
      }

      if (categoryFilter !== 'ALL' && tx.category !== categoryFilter) {
        return false;
      }

      if (
        dateFilter === 'THIS_MONTH' &&
        !tx.date.startsWith(thisMonthPrefix)
      ) {
        return false;
      }

      if (
        dateFilter === 'LAST_MONTH' &&
        !tx.date.startsWith(lastMonthPrefix)
      ) {
        return false;
      }

      if (reviewFilter === 'PENDING' && tx.verificationStatus !== 'PENDING') return false;
      if (reviewFilter === 'RECONCILED' && tx.verificationStatus !== 'RECONCILED') return false;
      if (reviewFilter === 'UNCATEGORIZED' && (tx.type !== 'EXPENSE' || (Boolean(tx.category?.trim()) && tx.category.trim() !== 'ללא קטגוריה'))) return false;

      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const payeeMatch = tx.payee.toLowerCase().includes(query);
        const categoryMatch = tx.category.toLowerCase().includes(query);
        const notesMatch = tx.notes
          ? tx.notes.toLowerCase().includes(query)
          : false;

        const account = accountsMap.get(tx.accountId);
        const accountMatch = account
          ? account.name.toLowerCase().includes(query)
          : false;

        if (
          !payeeMatch &&
          !categoryMatch &&
          !notesMatch &&
          !accountMatch
        ) {
          return false;
        }
      }

      return true;
    }).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
  }, [
    transactions,
    accountFilter,
    typeFilter,
    categoryFilter,
    dateFilter,
    reviewFilter,
    searchTerm,
    accountsMap,
    thisMonthPrefix,
    lastMonthPrefix,
  ]);

  const visibleCurrencies = new Set<string>(filteredTransactions
    .filter(tx => tx.verificationStatus !== 'PENDING' && Number.isSafeInteger(tx.amountCents) && tx.amountCents > 0)
    .flatMap(tx => {
      const currency = accountsMap.get(tx.accountId)?.currency;
      return currency ? [currency] : [];
    }));
  const selectedSummaryCurrency = accountFilter !== 'ALL'
    ? accountsMap.get(accountFilter)?.currency || 'ILS'
    : visibleCurrencies.size === 1 ? [...visibleCurrencies][0] : 'ILS';
  const filteredSummary = useMemo(() => {
    const totals = filteredTransactions
      .filter(tx =>
        (accountsMap.get(tx.accountId)?.currency || 'ILS') === selectedSummaryCurrency &&
        tx.verificationStatus !== 'PENDING' &&
        Number.isSafeInteger(tx.amountCents) &&
        tx.amountCents > 0
      )
      .reduce((result, tx) => {
        if (tx.type === 'INCOME') result.incomeCents += tx.amountCents;
        if (tx.type === 'EXPENSE') result.expenseCents += tx.amountCents;
        if (tx.type === 'TRANSFER' && tx.transferDirection === 'OUT') result.transferCents += tx.amountCents;
        return result;
      }, { incomeCents: 0, expenseCents: 0, transferCents: 0 });
    return { ...totals, currency: selectedSummaryCurrency };
  }, [filteredTransactions, accountsMap, selectedSummaryCurrency]);

  const hasActiveFilters = Boolean(searchTerm.trim()) || typeFilter !== 'ALL' || accountFilter !== 'ALL' || categoryFilter !== 'ALL' || dateFilter !== 'ALL' || reviewFilter !== 'ALL';
  const clearFilters = () => {
    setSearchTerm('');
    setTypeFilter('ALL');
    setAccountFilter('ALL');
    setCategoryFilter('ALL');
    setDateFilter('ALL');
    setReviewFilter('ALL');
    onSelectAccount?.(null);
  };

  const confirmDelete = async () => {
    if (!deletingTx) return;

    setIsDeleting(true);

    try {
      await onDeleteTransaction(deletingTx.id);
      setDeletingTx(null);
      setDeleteError('');
    } catch (err) {
      console.error(err);
      setDeleteError(err instanceof Error ? err.message : 'מחיקת העסקה נכשלה. הנתונים לא שונו.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="homeos-ledger-view homeos-workspace-page space-y-7" dir="rtl">
      <WorkspacePageHeader
        eyebrow="FINANCIAL OPERATIONS / LEDGER"
        title="פנקס העסקאות"
        description="תנועות הכסף של משק הבית — חיפוש, סינון, אימות ובקרה במקום אחד."
        meta={<><span>{filteredTransactions.length.toLocaleString('he-IL')} תנועות בתצוגה</span><span>{transactions.filter(tx => tx.verificationStatus === 'PENDING').length} ממתינות לאימות</span><span>{accounts.length} חשבונות מקושרים</span></>}
      />
      <p className="homeos-ledger-note">הסיכומים כוללים עסקאות מאושרות בשקלים בלבד. עסקאות שממתינות לבדיקה מוצגות בפנקס אך אינן נכללות ביתרות ובסכומים.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* סך הכנסות */}
        <div
          className="p-6 rounded-2xl border bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          style={{ borderColor: activeTheme.borderSubtle }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500 font-sans">
              סך כל ההכנסות
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700">
              <ArrowDownRight className="w-4 h-4" />
            </div>
          </div>

          <div className="font-mono text-2xl font-bold tracking-tight text-emerald-700">
            {formatCents(summary.incomeCents)}
          </div>

          <span className="text-[11px] text-stone-400 mt-1 block">
            חשבונות בשקלים בלבד · ללא המרות מטבע
          </span>
        </div>

        {/* סך הוצאות */}
        <div
          className="p-5 rounded-2xl border bg-white shadow-xs transition-all"
          style={{ borderColor: activeTheme?.borderSubtle ?? '#e7e5e4' }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500 font-sans">
              סך כל ההוצאות
            </span>
            <div className="p-1.5 rounded-lg bg-stone-100 text-stone-700">
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>

          <div className="font-mono text-2xl font-bold tracking-tight text-stone-800">
            {formatCents(summary.expenseCents)}
          </div>

          <span className="text-[11px] text-stone-400 mt-1 block">
            לא כולל העברות פנימיות
          </span>
        </div>

        {/* תזרים נטו */}
        <div
          className="p-5 rounded-2xl border bg-white shadow-xs transition-all"
          style={{ borderColor: activeTheme.borderSubtle }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500 font-sans">
              תזרים נטו (הכנסות מול הוצאות)
            </span>

            <div
              className={`p-1.5 rounded-lg ${
                summary.netCashflowCents >= 0
                  ? 'bg-emerald-50 text-emerald-700'
                  : 'bg-rose-50 text-rose-700'
              }`}
            >
              {summary.netCashflowCents >= 0 ? (
                <ArrowDownRight className="w-4 h-4" />
              ) : (
                <ArrowUpRight className="w-4 h-4" />
              )}
            </div>
          </div>

          <div
            className={`font-mono text-2xl font-bold tracking-tight ${
              summary.netCashflowCents >= 0
                ? 'text-emerald-700'
                : 'text-rose-700'
            }`}
          >
            {formatCents(summary.netCashflowCents)}
          </div>

          <span className="text-[11px] text-stone-400 mt-1 block">
            {summary.netCashflowCents >= 0
              ? 'עודף תזרימי חיובי'
              : 'גירעון תזרימי'}
          </span>
        </div>

        {/* העברות פנימיות */}
        <div
          className="p-5 rounded-2xl border bg-white shadow-xs transition-all"
          style={{ borderColor: activeTheme.borderSubtle }}
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-stone-500 font-sans">
              העברות וסליקות פנימיות
            </span>
            <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700">
              <ArrowLeftRight className="w-4 h-4" />
            </div>
          </div>

          <div className="font-mono text-2xl font-bold tracking-tight text-blue-800">
            {formatCents(summary.transferVolumeCents)}
          </div>

          <span className="text-[11px] text-stone-400 mt-1 block">
            תנועות בין חשבונות (ללא שינוי שווי)
          </span>
        </div>
      </div>

      {/* טבלת העסקאות */}
      <div
        className="rounded-[1.5rem] border bg-white shadow-sm overflow-hidden"
        style={{ borderColor: activeTheme.borderSubtle }}
      >
        {/* כותרת וסרגל סינון */}
        <div className="p-6 sm:p-7 border-b border-stone-200/80 space-y-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-serif text-xl font-bold text-stone-900 tracking-tight flex items-center gap-2">
                <span>ספר עסקאות מרכזי</span>

                <span className="text-xs px-2.5 py-0.5 rounded-full bg-stone-100 text-stone-600 font-sans font-medium">
                  {filteredTransactions.length} תנועות
                </span>
              </h2>

              <p className="text-xs text-stone-500 mt-0.5 font-sans">
                רישום מלא של כלל התנועות הכספיות, סיווג לפי קטגוריות והעברות פנימיות
              </p>
            </div>

            {/* כפתורי פעולה */}
            <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={onAddTransfer}
                disabled={!canEdit || accounts.length < 2}
                title={
                  accounts.length < 2
                    ? 'נדרשים לפחות 2 חשבונות לביצוע העברה'
                    : ''
                }
                className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl border border-blue-200 bg-blue-50/70 text-blue-800 hover:bg-blue-100 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <ArrowLeftRight className="w-3.5 h-3.5" />
                <span>העברה בין חשבונות</span>
              </button>

              <button
                type="button"
                onClick={onAddTransaction}
                disabled={!canEdit || accounts.length === 0}
                className="flex-1 sm:flex-initial px-4 py-2 rounded-xl text-white text-xs font-bold flex items-center justify-center gap-1.5 transition-all shadow-sm hover:opacity-95 disabled:opacity-50"
                style={{ backgroundColor: activeTheme.accent }}
              >
                <Plus className="w-4 h-4" />
                <span>עסקה חדשה</span>
              </button>
            </div>
          </div>

          {/* סרגל סינון */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 xl:grid-cols-7 gap-2.5 pt-2 border-t border-stone-100">
            {/* חיפוש */}
            <div className="relative md:col-span-2">
              <input
                type="text"
                placeholder="חיפוש בית עסק, הערה או קטגוריה..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-3 pr-8 py-2 rounded-xl border border-stone-200 text-xs font-sans bg-stone-50/50 focus:bg-white focus:outline-none focus:border-amber-700"
              />

              <Search className="w-3.5 h-3.5 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
            </div>

            {/* סינון לפי חשבון */}
            <div>
              <select
                value={accountFilter}
                onChange={(e) => {
                  setAccountFilter(e.target.value);

                  if (onSelectAccount) {
                    onSelectAccount(
                      e.target.value === 'ALL' ? null : e.target.value
                    );
                  }
                }}
                className="w-full px-2.5 py-2 rounded-xl border border-stone-200 text-xs font-sans bg-stone-50/50 focus:bg-white focus:outline-none focus:border-amber-700"
              >
                <option value="ALL">כל החשבונות</option>

                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>

            {/* סינון לפי קטגוריה */}
            <div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full px-2.5 py-2 rounded-xl border border-stone-200 text-xs font-sans bg-stone-50/50 focus:bg-white focus:outline-none focus:border-amber-700"
              >
                <option value="ALL">כל הקטגוריות</option>
                {uniqueCategories.map((category) => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            {/* סינון לפי סוג פעולה */}
            <div>
              <select
                value={typeFilter}
                onChange={(e) =>
                  setTypeFilter(e.target.value as 'ALL' | TransactionType)
                }
                className="w-full px-2.5 py-2 rounded-xl border border-stone-200 text-xs font-sans bg-stone-50/50 focus:bg-white focus:outline-none focus:border-amber-700"
              >
                <option value="ALL">כל סוגי הפעולות</option>
                <option value="EXPENSE">הוצאות בלבד</option>
                <option value="INCOME">הכנסות בלבד</option>
                <option value="TRANSFER">העברות פנימיות</option>
              </select>
            </div>

            {/* סינון לפי סטטוס בדיקה */}
            <div>
              <select
                value={reviewFilter}
                onChange={(e) => setReviewFilter(e.target.value as 'ALL' | 'PENDING' | 'UNCATEGORIZED' | 'RECONCILED')}
                className="w-full px-2.5 py-2 rounded-xl border border-stone-200 text-xs font-sans bg-stone-50/50 focus:bg-white focus:outline-none focus:border-amber-700"
              >
                <option value="ALL">כל סטטוסי הבדיקה</option>
                <option value="PENDING">ממתינות לאימות</option>
                <option value="RECONCILED">מותאמות לדף חשבון</option>
                <option value="UNCATEGORIZED">הוצאות ללא קטגוריה</option>
              </select>
            </div>

            {/* סינון לפי תאריך */}
            <div>
              <select
                value={dateFilter}
                onChange={(e) =>
                  setDateFilter(
                    e.target.value as 'ALL' | 'THIS_MONTH' | 'LAST_MONTH'
                  )
                }
                className="w-full px-2.5 py-2 rounded-xl border border-stone-200 text-xs font-sans bg-stone-50/50 focus:bg-white focus:outline-none focus:border-amber-700"
              >
                <option value="ALL">כל הזמנים</option>
                <option value="THIS_MONTH">חודש נוכחי</option>
                <option value="LAST_MONTH">חודש קודם</option>
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-stone-50/70 px-4 py-3">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px]">
              <span className="font-semibold text-stone-600">תוצאות הסינון: {filteredTransactions.length} תנועות</span>
              <span className="text-emerald-700">הכנסות: <strong>{formatCents(filteredSummary.incomeCents, filteredSummary.currency)}</strong></span>
              <span className="text-stone-700">הוצאות: <strong>{formatCents(filteredSummary.expenseCents, filteredSummary.currency)}</strong></span>
              <span className="text-blue-700">העברות יוצאות: <strong>{formatCents(filteredSummary.transferCents, filteredSummary.currency)}</strong></span>
              <span className="font-bold text-stone-800">תזרים מסונן: {formatCents(filteredSummary.incomeCents - filteredSummary.expenseCents, filteredSummary.currency)}</span>
            </div>
            {hasActiveFilters && <button type="button" onClick={clearFilters} className="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-[11px] font-semibold text-stone-700 transition hover:bg-stone-100">נקה את כל הסינונים</button>}
          </div>
        </div>

        {/* תוכן הטבלה */}
        <div className="overflow-x-auto">
          {filteredTransactions.length === 0 ? (
            <div className="text-center py-16 px-4">
              <FileSpreadsheet className="w-10 h-10 text-stone-300 mx-auto mb-3" />

              <h3 className="font-serif text-base font-bold text-stone-700">
                לא נמצאו עסקאות התואמות לסינון
              </h3>

              <p className="text-xs text-stone-500 mt-1 max-w-sm mx-auto">
                נסה לשנות את תנאי החיפוש, או לחץ על עסקה חדשה להזנת התנועה הראשונה בספר.
              </p>
            </div>
          ) : (
            <table className="w-full text-right text-xs">
              <thead className="bg-stone-50/80 text-stone-500 font-semibold border-b border-stone-200">
                <tr>
                  <th className="py-3 px-4">תאריך</th>
                  <th className="py-3 px-4">בית עסק / תיאור פעולה</th>
                  <th className="py-3 px-4">חשבון</th>
                  <th className="py-3 px-4">קטגוריה</th>
                  <th className="py-3 px-4">מקור ואימות</th>
                  <th className="py-3 px-4 text-left">סכום</th>
                  <th className="py-3 px-4 text-center">פעולות</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-stone-100">
                {filteredTransactions.map((tx) => {
                  const account = accountsMap.get(tx.accountId);
                  const isIncome = tx.type === 'INCOME';
                  const isExpense = tx.type === 'EXPENSE';
                  const isTransfer = tx.type === 'TRANSFER';

                  const isTransferOut =
                    isTransfer && tx.transferDirection === 'OUT';

                  const isTransferIn =
                    isTransfer && tx.transferDirection === 'IN';

                  return (
                    <tr
                      key={tx.id}
                      className="hover:bg-stone-50/60 transition-colors group"
                    >
                      {/* תאריך */}
                      <td className="py-3.5 px-4 font-mono text-stone-600 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium text-stone-900">
                            {tx.date}
                          </span>

                          {tx.valueDate && tx.valueDate !== tx.date && (
                            <span className="text-[10px] text-stone-400">
                              ערך: {tx.valueDate}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* בית עסק / תיאור */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div
                            className={`p-1.5 rounded-lg shrink-0 ${
                              isIncome
                                ? 'bg-emerald-50 text-emerald-700'
                                : isExpense
                                ? 'bg-stone-100 text-stone-700'
                                : 'bg-blue-50 text-blue-700'
                            }`}
                          >
                            {isIncome && (
                              <ArrowDownRight className="w-3.5 h-3.5" />
                            )}

                            {isExpense && (
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            )}

                            {isTransfer && (
                              <ArrowLeftRight className="w-3.5 h-3.5" />
                            )}
                          </div>

                          <div>
                            <div className="font-semibold text-stone-900 flex items-center gap-1.5">
                              <span>{displayLedgerText(tx.payee)}</span>

                              {isTransfer && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-sans font-medium">
                                  {isTransferOut ? 'יוצא' : 'נכנס'}
                                </span>
                              )}
                            </div>

                            {tx.notes && (
                              <div className="text-[11px] text-stone-500 mt-0.5 line-clamp-1">
                                {displayLedgerText(tx.notes)}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* חשבון */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-stone-100/90 text-stone-800 font-medium">
                          <span
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{
                              backgroundColor: account?.color || '#78716C',
                            }}
                          />

                          <span>
                            {account ? displayLedgerText(account.name) : 'חשבון הוסר'}
                          </span>
                        </span>
                      </td>

                      {/* קטגוריה */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className="text-stone-700 font-sans font-medium">
                          {displayLedgerText(tx.category)}
                        </span>
                      </td>

                      {/* מקור וסטטוס */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-stone-400 font-sans">
                            {tx.source === 'MANUAL' ? 'ידני' : 'ייבוא'}
                          </span>

                          {tx.verificationStatus === 'VERIFIED' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-medium">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              <span>מאומת</span>
                            </span>
                          ) : tx.verificationStatus === 'RECONCILED' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] text-blue-700 font-medium">
                              <CheckCircle2 className="w-3 h-3 text-blue-600" />
                              <span>מותאם לדף חשבון</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] text-amber-700 font-medium">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>בבדיקה</span>
                            </span>
                          )}
                        </div>
                      </td>

                      {/* סכום */}
                      <td
                        className="py-3.5 px-4 text-left font-mono text-sm font-bold whitespace-nowrap"
                        dir="ltr"
                      >
                        <span
                          className={
                            isIncome
                              ? 'text-emerald-700'
                              : isExpense
                              ? 'text-stone-800'
                              : isTransferIn
                              ? 'text-blue-700'
                              : 'text-stone-600'
                          }
                        >
                          {isIncome && '+ '}
                          {isExpense && '- '}
                          {isTransfer && (isTransferIn ? '+ ' : '- ')}
                          {formatCents(tx.amountCents, accountsMap.get(tx.accountId)?.currency || 'ILS')}
                        </span>
                      </td>

                      {/* פעולות */}
                      <td className="py-3.5 px-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => onEditTransaction(tx)}
                            disabled={!canEdit}
                            title="עריכת עסקה"
                            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors disabled:opacity-30"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => { setDeleteError(''); setDeletingTx(tx); }}
                            disabled={!canEdit}
                            title="מחיקת עסקה"
                            className="p-1.5 rounded-lg text-stone-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-30"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* חלון אישור מחיקה */}
      {deletingTx && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fadeIn"
          dir="rtl"
        >
          <div className="w-full max-w-md p-6 rounded-2xl bg-white border border-stone-200 shadow-2xl space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-600">
                <AlertTriangle className="w-5 h-5" />
              </div>

              <div>
                <h3 className="font-serif text-lg font-bold text-stone-900">
                  אישור מחיקת תנועה
                </h3>

                <p className="text-xs text-stone-500 font-sans">
                  פעולה זו תמחק את התנועה ותעדכן מיידית את יתרת החשבון.
                </p>
              </div>
            </div>

            {deletingTx.type === 'TRANSFER' ? (
              <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 text-xs leading-relaxed">
                <strong>שים לב: זוהי העברה פנימית מקושרת.</strong>

                <p className="mt-1 text-blue-800">
                  מחיקת תנועה זו תמחק באופן אוטומטי גם את הרגל הנגדית המשויכת אליה, ויתרות שני החשבונות ישוחזרו במלואן.
                </p>
              </div>
            ) : (
              <div className="p-3.5 rounded-xl bg-stone-50 border border-stone-200 text-xs text-stone-700">
                מחיקת עסקה ע"ס{' '}
                <strong>{formatCents(deletingTx.amountCents, accountsMap.get(deletingTx.accountId)?.currency || 'ILS')}</strong>{' '}
                מבית עסק <strong>{deletingTx.payee}</strong>.
              </div>
            )}

            {deleteError && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 text-rose-800">{deleteError}</div>}

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-stone-100">
              <button
                type="button"
                onClick={() => setDeletingTx(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-stone-300 text-stone-700 text-xs font-medium hover:bg-stone-50 transition-colors"
              >
                ביטול
              </button>

              <button
                type="button"
                onClick={confirmDelete}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-colors shadow-sm disabled:opacity-50"
              >
                {isDeleting ? 'מוחק...' : 'מחק לצמיתות'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

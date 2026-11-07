import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft, ArrowUpLeft, Wallet, Landmark, Activity, TrendingUp,
  TrendingDown, Lightbulb, CalendarDays, Sparkles, ArrowUpRight,
  ArrowDownRight, ArrowLeftRight, ChartNoAxesCombined, ReceiptText, ArrowLeft,
  PiggyBank, ShieldCheck, ChevronLeft, CircleDollarSign
} from 'lucide-react';
import { FinancialAccount, LedgerTransaction } from '../types.ts';
import { ThemeConfig } from '../lib/themes.ts';

interface DashboardViewProps {
  accounts: FinancialAccount[];
  transactions: LedgerTransaction[];
  householdName: string;
  activeTheme: ThemeConfig;
  onOpenAccounts: () => void;
  onOpenLedger: () => void;
}

const money = (value: number) => new Intl.NumberFormat('he-IL', {
  style: 'currency', currency: 'ILS', maximumFractionDigits: 0,
}).format(value);
const monthLabel = (date: Date) => new Intl.DateTimeFormat('he-IL', { month: 'short' }).format(date);

export const DashboardView: React.FC<DashboardViewProps> = ({
  accounts, transactions, householdName, activeTheme, onOpenAccounts, onOpenLedger,
}) => {
  const [chartDetail, setChartDetail] = useState<{ title: string; subtitle: string; items: LedgerTransaction[] } | null>(null);

  useEffect(() => {
    if (!chartDetail) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setChartDetail(null);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chartDetail]);

  const data = useMemo(() => {
    const activeAccounts = accounts.filter(a => a.status === 'ACTIVE');
    // Keep displayed account counts consistent with the exact balance classifications.
    // An overdrawn checking account is a liability, not a negative asset.
    const assetAccounts = activeAccounts.filter(a => !a.isLiability && (a.currentBalanceCents || 0) > 0);
    const liabilityAccounts = activeAccounts.filter(a => a.isLiability || (a.type === 'CHECKING' && (a.currentBalanceCents || 0) < 0));
    const assets = assetAccounts.reduce((s, a) => s + (a.currentBalanceCents || 0), 0);
    const liabilities = liabilityAccounts.reduce((s, a) => s + Math.abs(a.currentBalanceCents || 0), 0);
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      const key = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
      const monthTx = transactions.filter(tx => tx.date && tx.date.slice(0, 7) === key);
      return {
        key, label: monthLabel(date),
        income: monthTx.filter(tx => tx.type === 'INCOME').reduce((s, tx) => s + tx.amountCents, 0),
        expense: monthTx.filter(tx => tx.type === 'EXPENSE').reduce((s, tx) => s + tx.amountCents, 0),
      };
    });
    const currentKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const current = months.find(m => m.key === currentKey) || { income: 0, expense: 0, label: '' };
    const previous = months[months.length - 2] || { income: 0, expense: 0, label: '' };
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentMonthTransactions = transactions.filter(tx => tx.date?.slice(0, 7) === currentKey && (tx.type === 'INCOME' || tx.type === 'EXPENSE'));
    const currentTransactionDays = new Set(currentMonthTransactions.map(tx => tx.date)).size;
    const projectionReady = currentDay >= 3 && currentTransactionDays >= 3 && currentMonthTransactions.length >= 5;
    const paceFactor = daysInMonth / Math.max(1, currentDay);
    const projectedIncome = Math.round(current.income * paceFactor);
    const projectedExpense = Math.round(current.expense * paceFactor);
    const projectedCashflow = projectedIncome - projectedExpense;
    const expenseToDate = transactions.filter(tx => tx.type === 'EXPENSE' && tx.date?.slice(0, 7) === currentKey && Number(tx.date.slice(8, 10)) <= currentDay)
      .reduce((sum, tx) => sum + tx.amountCents, 0);
    const previousExpenseToDate = transactions.filter(tx => tx.type === 'EXPENSE' && tx.date?.slice(0, 7) === previous.key && Number(tx.date.slice(8, 10)) <= currentDay)
      .reduce((sum, tx) => sum + tx.amountCents, 0);
    const expenseChange = previousExpenseToDate > 0 ? ((expenseToDate - previousExpenseToDate) / previousExpenseToDate) * 100 : null;
    const max = Math.max(1, ...months.flatMap(m => [m.income, m.expense]));
    const categories = transactions.filter(tx => tx.type === 'EXPENSE' && tx.date && tx.date.slice(0, 7) === currentKey)
      .reduce<Record<string, number>>((acc, tx) => {
        const key = tx.category || 'ללא קטגוריה';
        acc[key] = (acc[key] || 0) + tx.amountCents;
        return acc;
      }, {});
    const topCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
    const completedMonths = months.slice(0, -1).slice(-3);
    const baselineExpense = completedMonths.reduce((s, m) => s + m.expense, 0) / Math.max(1, completedMonths.length);
    const baselineIncome = completedMonths.reduce((s, m) => s + m.income, 0) / Math.max(1, completedMonths.length);
    const baselineCashflow = baselineIncome - baselineExpense;
    const baselineSavingsRate = baselineIncome > 0 ? (baselineCashflow / baselineIncome) * 100 : null;
    const baselineTransactionCount = transactions.filter(tx => completedMonths.some(m => tx.date?.slice(0, 7) === m.key) && (tx.type === 'INCOME' || tx.type === 'EXPENSE')).length;
    const averageExpense = completedMonths.reduce((s, m) => s + m.expense, 0) / Math.max(1, completedMonths.length);
    const cashflow = current.income - current.expense;
    const pendingReviewCount = transactions.filter(tx => tx.verificationStatus === 'PENDING').length;
    const uncategorizedExpenseCount = transactions.filter(tx => tx.type === 'EXPENSE' && (!tx.category?.trim() || tx.category.trim() === 'ללא קטגוריה')).length;

    // Compare the current month's category run-rate with the average of the prior
    // three complete months. This is a review signal, not a promised saving.
    const savingsInsights = projectionReady && completedMonths.length === 3
      ? Object.entries(categories).map(([category, currentAmount]) => {
          const categoryTransactions = currentMonthTransactions.filter(tx => tx.type === 'EXPENSE' && (tx.category || 'ללא קטגוריה') === category);
          const categoryHistory = completedMonths.map(month => transactions
            .filter(tx => tx.type === 'EXPENSE' && tx.date?.slice(0, 7) === month.key && (tx.category || 'ללא קטגוריה') === category)
            .reduce((monthSum, tx) => monthSum + tx.amountCents, 0));
          const historicalTotal = categoryHistory.reduce((sum, amount) => sum + amount, 0);
          const historicalMonthsPresent = categoryHistory.filter(amount => amount > 0).length;
          const historicalAverage = historicalTotal / 3;
          const projected = Math.round(currentAmount * paceFactor);
          const increase = projected - historicalAverage;
          return { category, currentAmount, projected, historicalAverage, historicalMonthsPresent, increase, transactionCount: categoryTransactions.length };
        })
        .filter(item => item.transactionCount >= 2 && item.historicalMonthsPresent >= 2 && item.historicalAverage > 0 && item.increase >= 5000 && item.projected >= item.historicalAverage * 1.2)
        .sort((a, b) => b.increase - a.increase)
        .slice(0, 3)
      : [];
    // Surface possible recurring expense patterns from repeated merchant/category activity.
    // This is deliberately a review signal, not proof of a subscription or fixed bill.
    const monthKeys = new Set(months.map(month => month.key));
    const recurringGroups = new Map<string, { payee: string; category: string; monthlyAmounts: Map<string, number>; items: LedgerTransaction[] }>();
    for (const tx of transactions) {
      if (tx.type !== 'EXPENSE' || !tx.date || !monthKeys.has(tx.date.slice(0, 7)) || !tx.payee?.trim()) continue;
      const payee = tx.payee.trim().replace(/\\s+/g, ' ');
      const normalizedPayee = payee.toLocaleLowerCase('he-IL');
      const category = tx.category?.trim() || 'ללא קטגוריה';
      const key = normalizedPayee + '|' + category;
      let group = recurringGroups.get(key);
      if (!group) {
        group = { payee, category, monthlyAmounts: new Map<string, number>(), items: [] };
        recurringGroups.set(key, group);
      }
      const monthKey = tx.date.slice(0, 7);
      group.monthlyAmounts.set(monthKey, (group.monthlyAmounts.get(monthKey) || 0) + tx.amountCents);
      group.items.push(tx);
    }
    const recurringExpenses = [...recurringGroups.values()].map(group => {
      const amounts = [...group.monthlyAmounts.values()];
      const averageAmount = amounts.reduce((sum, amount) => sum + amount, 0) / Math.max(1, amounts.length);
      const minAmount = Math.min(...amounts);
      const maxAmount = Math.max(...amounts);
      return {
        payee: group.payee,
        category: group.category,
        monthCount: amounts.length,
        averageAmount: Math.round(averageAmount),
        currentMonthAmount: group.monthlyAmounts.get(currentKey) || 0,
        minAmount,
        maxAmount,
        items: group.items,
      };
    })
      .filter(item => item.monthCount >= 3 && item.averageAmount >= 5000 && item.minAmount > 0 && item.maxAmount <= item.minAmount * 1.5)
      .sort((a, b) => b.averageAmount - a.averageAmount)
      .slice(0, 4);

    return { assets, liabilities, netWorth: assets - liabilities, months, max, current, previous, expenseChange, topCategories, recent, activeAccounts, assetAccountCount: assetAccounts.length, liabilityAccountCount: liabilityAccounts.length, averageExpense, cashflow, baselineExpense, baselineIncome, baselineCashflow, baselineSavingsRate, baselineTransactionCount, baselineMonthCount: completedMonths.length, currentDay, daysInMonth, currentTransactionDays, projectionReady, projectedIncome, projectedExpense, projectedCashflow, savingsInsights, recurringExpenses, pendingReviewCount, uncategorizedExpenseCount };
  }, [accounts, transactions]);

  const currency = (cents: number) => money(cents / 100);
  const muted = { color: activeTheme.textSecondary };
  const panel = 'homeos-lux-panel';
  const categoryTotal = data.topCategories.reduce((sum, item) => sum + item[1], 0);
  const categoryColors = ['#B98B58', '#547D70', '#8295A7', '#A97972', '#9C9A7D'];
  const monthName = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(new Date());
  const hasActivity = data.current.income > 0 || data.current.expense > 0;

  return (
    <div className="homeos-dashboard space-y-6 pb-10" dir="rtl">
      <header className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="homeos-kicker"><span className="homeos-live-dot" /> HOME OS <span className="opacity-30">/</span> PRIVATE FINANCIAL DESK</div>
          <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: activeTheme.textPrimary }}>המרכז הפיננסי של {householdName || 'הבית'}</h1>
          <p className="mt-2 text-sm" style={muted}>כל הנכסים, ההתחייבויות והתזרים — במבט אחד מדויק.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="homeos-date-chip"><CalendarDays className="h-4 w-4" /> {monthName}</span>
          <button onClick={onOpenLedger} className="homeos-primary-action"><ReceiptText className="h-4 w-4" /> פנקס העסקאות</button>
          <button onClick={onOpenAccounts} className="homeos-secondary-action"><Landmark className="h-4 w-4" /> ניהול חשבונות</button>
        </div>
      </header>

      <section className="homeos-wealth-hero">
        <div className="homeos-hero-orbit homeos-orbit-one" />
        <div className="homeos-hero-orbit homeos-orbit-two" />
        <div className="homeos-hero-glow" />
        <div className="relative z-10 grid gap-8 xl:grid-cols-[1.15fr_.85fr] xl:items-end">
          <div>
            <div className="flex items-center gap-2 text-sm text-white/65"><CircleDollarSign className="h-4 w-4 text-[#D5B184]" /> השווי הנקי הכולל</div>
            <div className="mt-4 flex flex-wrap items-end gap-x-4 gap-y-2">
              <strong className="homeos-net-worth">{currency(data.netWorth)}</strong>
              <span className="mb-2 rounded-full border border-white/15 bg-white/[.07] px-3 py-1.5 text-[11px] text-white/65">נכסים פחות התחייבויות</span>
            </div>
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/55">תמונת ההון של משק הבית, המחושבת מתוך היתרות בחשבונות הפעילים שלך.</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button onClick={onOpenAccounts} className="homeos-hero-button">סקירת הנכסים <ChevronLeft className="h-4 w-4" /></button>
              <span className="flex items-center gap-2 text-xs text-white/45"><ShieldCheck className="h-4 w-4 text-[#B7C9B8]" /> נתונים מקומיים ומאובטחים במכשיר</span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <div className="homeos-hero-metric"><span className="homeos-metric-icon"><TrendingUp className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="text-xs text-white/50">נכסים</div><div className="mt-1 text-xl font-semibold tabular-nums text-white">{currency(data.assets)}</div></div><span className="text-[10px] text-white/35">{data.assetAccountCount} חשבונות</span></div>
            <div className="homeos-hero-metric"><span className="homeos-metric-icon copper"><TrendingDown className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="text-xs text-white/50">התחייבויות</div><div className="mt-1 text-xl font-semibold tabular-nums text-white">{currency(data.liabilities)}</div></div><span className="text-[10px] text-white/35">{data.liabilityAccountCount} התחייבויות</span></div>
            <div className="homeos-hero-metric"><span className="homeos-metric-icon blue"><Activity className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="text-xs text-white/50">תזרים החודש</div><div className="mt-1 text-xl font-semibold tabular-nums text-white">{currency(data.cashflow)}</div></div><span className="text-[10px] text-white/35">הכנסות פחות הוצאות</span></div>
          </div>
        </div>
        <div className="homeos-hero-footer"><span>HOUSEHOLD WEALTH OVERVIEW</span><span>01 — FINANCIAL POSITION</span></div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <button type="button" onClick={() => setChartDetail({ title: "הכנסות החודש", subtitle: "כל ההכנסות שנרשמו בחודש הנוכחי", items: transactions.filter(tx => tx.type === 'INCOME' && tx.date?.slice(0, 7) === data.months[5]?.key) })} className={panel + " text-right transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#547D70]"}><div className="homeos-card-top"><span>הכנסות החודש</span><span className="homeos-icon-tile green"><ArrowDownLeft className="h-5 w-5" /></span></div><div className="homeos-kpi-value green">{currency(data.current.income)}</div><div className="homeos-card-foot">לחץ לפירוט ההכנסות</div></button>
        <button type="button" onClick={() => setChartDetail({ title: "הוצאות החודש", subtitle: "כל ההוצאות שנרשמו בחודש הנוכחי", items: transactions.filter(tx => tx.type === 'EXPENSE' && tx.date?.slice(0, 7) === data.months[5]?.key) })} className={panel + " text-right transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#547D70]"}><div className="homeos-card-top"><span>הוצאות החודש</span><span className="homeos-icon-tile copper"><ArrowUpLeft className="h-5 w-5" /></span></div><div className="homeos-kpi-value">{currency(data.current.expense)}</div><div className="homeos-card-foot">לחץ לפירוט ההוצאות</div></button>
        <button type="button" onClick={() => setChartDetail({ title: "מאזן חודשי", subtitle: "הכנסות והוצאות בחודש הנוכחי", items: transactions.filter(tx => tx.date?.slice(0, 7) === data.months[5]?.key && (tx.type === 'INCOME' || tx.type === 'EXPENSE')) })} className={panel + " text-right transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#547D70]"}><div className="homeos-card-top"><span>מאזן חודשי</span><span className="homeos-icon-tile blue"><Activity className="h-5 w-5" /></span></div><div className={'homeos-kpi-value ' + (data.cashflow >= 0 ? 'green' : 'negative')}>{currency(data.cashflow)}</div><div className="homeos-card-foot">לחץ לפירוט התזרים</div></button>
        <button type="button" onClick={() => setChartDetail({ title: "השוואת הוצאות חודשית", subtitle: "עסקאות הוצאה בחודש הנוכחי ובחודש הקודם", items: transactions.filter(tx => tx.type === 'EXPENSE' && [data.months[5]?.key, data.months[4]?.key].includes(tx.date?.slice(0, 7))) })} className={panel + " text-right transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-[#547D70]"}><div className="homeos-card-top"><span>שינוי בהוצאות</span><span className="homeos-icon-tile neutral"><CalendarDays className="h-5 w-5" /></span></div><div className="homeos-kpi-value">{data.expenseChange === null ? '—' : ((data.expenseChange > 0 ? '+' : '') + data.expenseChange.toFixed(1) + '%')}</div><div className="homeos-card-foot">השוואה לאותם ימים בחודש הקודם · לחץ לפירוט</div></button>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.55fr_.85fr]">
        <div className={panel + ' p-5 sm:p-7'}>
          <div className="mb-7 flex flex-wrap items-start justify-between gap-3">
            <div><div className="homeos-section-kicker">CASH FLOW ANALYTICS</div><h2 className="mt-1 text-lg font-bold">תנועת הכסף לאורך זמן</h2><p className="mt-1 text-xs" style={muted}>השוואת הכנסות והוצאות · ששת החודשים האחרונים</p></div>
            <div className="flex gap-4 text-[11px]" style={muted}><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#547D70]" /> הכנסות</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#C49A69]" /> הוצאות</span></div>
          </div>
          <div className="homeos-chart-grid">
            {data.months.map((month, index) => (
              <button type="button" key={month.key} className="homeos-chart-month cursor-pointer rounded-xl px-1 transition hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-[#547D70] dark:hover:bg-white/10" aria-label={"פתיחת פירוט " + month.label} onClick={() => setChartDetail({ title: "פירוט " + month.label, subtitle: "הכנסות " + currency(month.income) + " · הוצאות " + currency(month.expense), items: transactions.filter(tx => tx.date && tx.date.slice(0, 7) === month.key && (tx.type === 'INCOME' || tx.type === 'EXPENSE')) })}>
                <div className="homeos-chart-bars">
                  <div className="homeos-chart-bar income" title={'הכנסות: ' + currency(month.income)} style={{ height: Math.max(month.income ? 3 : 1, month.income / data.max * 100) + '%', opacity: index === 5 ? 1 : .72 }} />
                  <div className="homeos-chart-bar expense" title={'הוצאות: ' + currency(month.expense)} style={{ height: Math.max(month.expense ? 3 : 1, month.expense / data.max * 100) + '%', opacity: index === 5 ? 1 : .72 }} />
                </div>
                <span>{month.label}</span>
              </button>
            ))}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-4 border-t pt-5" style={{ borderColor: activeTheme.borderSubtle }}>
            <div><div className="text-[11px]" style={muted}>מאזן החודש</div><div className="mt-1 text-lg font-bold tabular-nums" style={{ color: data.cashflow >= 0 ? '#477866' : '#B45F56' }}>{currency(data.cashflow)}</div></div>
            <div><div className="text-[11px]" style={muted}>ממוצע הוצאות · 3 חודשים מלאים</div><div className="mt-1 text-lg font-bold tabular-nums">{currency(data.averageExpense)}</div></div>
          </div>
        </div>

        <div className={panel + ' p-5 sm:p-7'}>
          <div className="homeos-section-kicker">SPENDING BREAKDOWN</div><h2 className="mt-1 text-lg font-bold">לאן הכסף הולך?</h2><p className="mt-1 text-xs" style={muted}>חמש הקטגוריות המובילות בהוצאות החודש</p>
          {data.topCategories.length ? <><div className="my-6 flex items-center justify-center"><div className="homeos-donut" style={{ background: 'conic-gradient(' + data.topCategories.map(([name, value], i) => { const start = data.topCategories.slice(0, i).reduce((s, x) => s + x[1], 0) / categoryTotal * 100; const end = (data.topCategories.slice(0, i).reduce((s, x) => s + x[1], 0) + value) / categoryTotal * 100; return categoryColors[i] + ' ' + start + '% ' + end + '%'; }).join(', ') + ')' }}><div><span>5 קטגוריות מובילות</span><strong>{currency(categoryTotal)}</strong></div></div></div><div className="space-y-3">{data.topCategories.map(([name, value], i) => <button type="button" key={name} onClick={() => setChartDetail({ title: "הוצאות: " + name, subtitle: "עסקאות בקטגוריה זו בחודש הנוכחי · " + currency(value), items: transactions.filter(tx => tx.type === 'EXPENSE' && tx.category === name && tx.date?.slice(0, 7) === data.months[5]?.key) })} className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-right text-xs transition hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-[#547D70] dark:hover:bg-white/10"><span className="flex min-w-0 items-center gap-2"><i className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: categoryColors[i] }} /><span className="truncate">{name}</span></span><strong className="shrink-0 tabular-nums">{currency(value)}</strong></button>)}</div></> : <div className="flex min-h-52 flex-col items-center justify-center text-center"><Sparkles className="mb-3 h-7 w-7" style={muted} /><p className="text-sm font-semibold">אין עדיין נתוני הוצאות</p><p className="mt-1 max-w-[220px] text-xs leading-5" style={muted}>לאחר רישום עסקאות יוצג כאן ניתוח לפי קטגוריות.</p></div>}
        </div>
      </section>

      <section className={panel + ' p-5 sm:p-7'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="homeos-section-kicker">HOUSEHOLD FORECAST</div>
            <h2 className="mt-1 text-lg font-bold">תחזית חודשית ותכנון קדימה</h2>
            <p className="mt-1 text-xs" style={muted}>ממוצעים היסטוריים לצד תחזית קצב לחודש הנוכחי — לא התחייבות לתוצאה.</p>
          </div>
          <span className="rounded-full bg-[#547D70]/10 px-3 py-1.5 text-[10px] font-semibold text-[#547D70]">מבוסס היסטוריה בפועל</span>
        </div>
        {data.baselineTransactionCount > 0 ? (
          <>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
              <div className="rounded-2xl border p-4" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgSurface }}>
                <div className="text-xs" style={muted}>הכנסה חודשית ממוצעת</div>
                <div className="mt-2 text-xl font-bold tabular-nums text-[#477866]">{currency(data.baselineIncome)}</div>
                <div className="mt-1 text-[10px]" style={muted}>ממוצע {data.baselineMonthCount} חודשים מלאים</div>
              </div>
              <div className="rounded-2xl border p-4" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgSurface }}>
                <div className="text-xs" style={muted}>הוצאה חודשית ממוצעת</div>
                <div className="mt-2 text-xl font-bold tabular-nums">{currency(data.baselineExpense)}</div>
                <div className="mt-1 text-[10px]" style={muted}>קו בסיס היסטורי</div>
              </div>
              <div className="rounded-2xl border p-4" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgSurface }}>
                <div className="text-xs" style={muted}>עודף / גירעון ממוצע</div>
                <div className={'mt-2 text-xl font-bold tabular-nums ' + (data.baselineCashflow >= 0 ? 'text-[#477866]' : 'text-[#B45F56]')}>{currency(data.baselineCashflow)}</div>
                <div className="mt-1 text-[10px]" style={muted}>על בסיס חודשים קודמים</div>
              </div>
              <div className="rounded-2xl border p-4" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgSurface }}>
                <div className="text-xs" style={muted}>תחזית הוצאות לסוף החודש</div>
                <div className="mt-2 text-xl font-bold tabular-nums">{data.projectionReady ? currency(data.projectedExpense) : 'ממתין לנתונים'}</div>
                <div className="mt-1 text-[10px]" style={muted}>{data.projectionReady ? 'לפי קצב ההוצאות עד היום' : 'נדרשות לפחות 3 ימי פעילות'}</div>
              </div>
              <div className="rounded-2xl border p-4" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgSurface }}>
                <div className="text-xs" style={muted}>תחזית תזרים לסוף החודש</div>
                <div className={'mt-2 text-xl font-bold tabular-nums ' + (data.projectedCashflow >= 0 ? 'text-[#477866]' : 'text-[#B45F56]')}>{data.projectionReady ? currency(data.projectedCashflow) : '—'}</div>
                <div className="mt-1 text-[10px]" style={muted}>אומדן לפי הקצב הנוכחי</div>
              </div>
              <div className="rounded-2xl border p-4" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgSurface }}>
                <div className="text-xs" style={muted}>שיעור עודף ממוצע</div>
                <div className={'mt-2 text-xl font-bold tabular-nums ' + (data.baselineSavingsRate !== null && data.baselineSavingsRate >= 0 ? 'text-[#477866]' : 'text-[#B45F56]')}>{data.baselineSavingsRate === null ? '—' : data.baselineSavingsRate.toFixed(1) + '%'}</div>
                <div className="mt-1 text-[10px]" style={muted}>תזרים נטו מתוך ההכנסה · היסטורי</div>
              </div>
            </div>
            {data.projectionReady && <div className="mt-4 rounded-2xl border p-4" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgSurface }}>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs"><strong>קצב החודש</strong><span style={muted}>יום {data.currentDay} מתוך {data.daysInMonth} · {data.currentTransactionDays} ימי פעילות</span></div>
              <div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: activeTheme.borderSubtle }}><div className="h-full rounded-full" style={{ width: (data.currentDay / data.daysInMonth * 100) + '%', background: 'linear-gradient(90deg,#547D70,#B98B58)' }} /></div>
              <div className="mt-2 flex justify-between text-[10px]" style={muted}><span>הוצאות בפועל: {currency(data.current.expense)}</span><span>תחזית: {currency(data.projectedExpense)}</span></div>
            </div>}
            <p className="mt-4 text-[11px] leading-5" style={muted}>
              הממוצעים מבוססים על {data.baselineMonthCount} חודשים מלאים שקדמו לחודש הנוכחי. תחזית סוף החודש היא חישוב קצב פשוט של הנתונים שנרשמו עד היום, ומוצגת רק לאחר לפחות 5 עסקאות הפרוסות על פני 3 ימי פעילות. היא אינה כוללת חיובים עתידיים שטרם נרשמו.
            </p>
          </>
        ) : (
          <div className="mt-5 rounded-2xl border p-5 text-sm" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgSurface, color: activeTheme.textSecondary }}>
            עדיין אין מספיק היסטוריית עסקאות כדי לחשב תחזית אמינה. לאחר הזנת עסקאות בחודשים קודמים יוצג כאן אומדן הכנסות, הוצאות ותזרים.
          </div>
        )}
      </section>

      <section className={panel + ' p-5 sm:p-7'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="homeos-section-kicker">SMART SAVINGS REVIEW</div>
            <h2 className="mt-1 text-lg font-bold">הזדמנויות לבדיקה ולייעול</h2>
            <p className="mt-1 text-xs" style={muted}>איתור סעיפים שקצב ההוצאה בהם גבוה מהממוצע ההיסטורי</p>
          </div>
          <span className="rounded-full bg-[#547D70]/10 px-3 py-1.5 text-[10px] font-semibold text-[#547D70]">מבוסס עסקאות בפועל</span>
        </div>
        {data.savingsInsights.length ? (
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.savingsInsights.map(item => (
              <div key={item.category} className="rounded-2xl border p-4" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgSurface }}>
                <div className="flex items-center gap-2 text-sm font-semibold"><Lightbulb className="h-4 w-4 shrink-0 text-[#B98B58]" />{item.category}</div>
                <div className="mt-3 text-xs" style={muted}>תחזית לסוף החודש</div>
                <div className="mt-1 text-xl font-bold tabular-nums">{currency(item.projected)}</div>
                <div className="mt-2 text-xs leading-5" style={muted}>לעומת ממוצע חודשי של {currency(item.historicalAverage)} בשלושת החודשים המלאים הקודמים — פער צפוי של {currency(item.increase)}. הסעיף הופיע ב-{item.historicalMonthsPresent} מתוך 3 חודשים, ונרשמו בו {item.transactionCount} עסקאות החודש.</div>
                <button type="button" onClick={() => setChartDetail({ title: "בדיקת הוצאות: " + item.category, subtitle: "עסקאות בקטגוריה בחודש הנוכחי", items: transactions.filter(tx => tx.type === 'EXPENSE' && (tx.category || 'ללא קטגוריה') === item.category && tx.date?.slice(0, 7) === data.months[5]?.key) })} className="homeos-text-link mt-3">בדיקת העסקאות <ArrowLeft className="h-4 w-4" /></button>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border p-4 text-sm leading-6" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgSurface, color: activeTheme.textSecondary }}>
            {data.baselineMonthCount < 3
              ? 'נדרשת היסטוריה של שלושה חודשים מלאים כדי לזהות חריגות באופן הוגן.'
              : !data.projectionReady
                ? 'לאחר לפחות 5 עסקאות הפרוסות על פני 3 ימי פעילות בחודש, נוכל להציג בדיקת קצב הוצאות.'
                : 'כרגע לא זוהתה חריגה מובהקת לפי הספים שהוגדרו. ממשיכים לעקוב.'}
          </div>
        )}
        <p className="mt-3 text-[10px] leading-5" style={muted}>ההתראות הן סימני בדיקה בלבד. הן אינן מעידות בהכרח על בזבוז ואינן מבטיחות חיסכון; יש להתחשב בעונתיות, חיובים חד-פעמיים והוצאות שטרם נרשמו.</p>
      </section>

      <section className={panel + ' p-5 sm:p-7'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="homeos-section-kicker">REPEATED SPENDING PATTERNS</div>
            <h2 className="mt-1 text-lg font-bold">חיובים ודפוסי הוצאה שחוזרים</h2>
            <p className="mt-1 text-xs" style={muted}>זיהוי ספקים וקטגוריות שהופיעו בסכומים דומים בלפחות 3 מתוך 6 החודשים האחרונים</p>
          </div>
          <span className="rounded-full bg-[#B98B58]/10 px-3 py-1.5 text-[10px] font-semibold text-[#9B7549]">לבדיקה · לא חיוב ודאי</span>
        </div>
        {data.recurringExpenses.length ? (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {data.recurringExpenses.map(item => (
              <button type="button" key={item.payee + item.category} onClick={() => setChartDetail({ title: "דפוס הוצאה: " + item.payee, subtitle: item.category + " · הופיע ב-" + item.monthCount + " מתוך 6 חודשים", items: item.items })} className="rounded-2xl border p-4 text-right transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#547D70]" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgSurface }}>
                <div className="flex items-center justify-between gap-2"><span className="truncate text-sm font-semibold">{item.payee}</span><span className="shrink-0 rounded-full bg-[#547D70]/10 px-2 py-1 text-[9px] font-semibold text-[#547D70]">{item.monthCount}/6 חודשים</span></div>
                <div className="mt-3 text-[10px]" style={muted}>{item.category}</div>
                <div className="mt-1 text-xl font-bold tabular-nums">{currency(item.averageAmount)}</div>
                <div className="mt-1 text-[10px]" style={muted}>ממוצע בחודשים שבהם הופיע</div>
                <div className="mt-3 border-t pt-2 text-[10px]" style={{ borderColor: activeTheme.borderSubtle, color: item.currentMonthAmount > 0 ? '#477866' : activeTheme.textSecondary }}>{item.currentMonthAmount > 0 ? 'נרשם החודש: ' + currency(item.currentMonthAmount) : 'טרם נרשם החודש'}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border p-4 text-sm leading-6" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgSurface, color: activeTheme.textSecondary }}>עדיין לא זוהו דפוסים חוזרים שעומדים בסף. נדרש ספק או תיאור שחוזר בלפחות 3 חודשים, עם סכומים בטווח דומה.</div>
        )}
        <p className="mt-3 text-[10px] leading-5" style={muted}>הזיהוי מבוסס על התאמה בין שם הספק והקטגוריה ועל סכומים דומים. ייתכן שמדובר בקניות חוזרות ולא במנוי או בהוראת קבע; לחיצה פותחת את העסקאות שעליהן מבוסס הזיהוי.</p>
      </section>

      <section className={panel + ' p-5 sm:p-7'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="homeos-section-kicker">DATA QUALITY CHECK</div>
            <h2 className="mt-1 text-lg font-bold">בקרת איכות נתוני העסקאות</h2>
            <p className="mt-1 text-xs" style={muted}>כדאי להשלים בדיקות לפני שמסתמכים על הניתוחים והתחזיות</p>
          </div>
          <span className="rounded-full bg-[#547D70]/10 px-3 py-1.5 text-[10px] font-semibold text-[#547D70]">בדיקה אוטומטית</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={onOpenLedger} className="flex items-center justify-between gap-3 rounded-2xl border p-4 text-right transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgSurface }}>
            <span><span className="block text-xs" style={muted}>עסקאות שממתינות לאימות</span><strong className="mt-1 block text-2xl tabular-nums">{data.pendingReviewCount}</strong><span className="mt-1 block text-[10px]" style={muted}>בדוק ואמת נתונים שיובאו</span></span>
            <span className="rounded-xl bg-[#B98B58]/10 p-3 text-[#B98B58]"><ShieldCheck className="h-5 w-5" /></span>
          </button>
          <button type="button" onClick={onOpenLedger} className="flex items-center justify-between gap-3 rounded-2xl border p-4 text-right transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgSurface }}>
            <span><span className="block text-xs" style={muted}>הוצאות ללא קטגוריה</span><strong className="mt-1 block text-2xl tabular-nums">{data.uncategorizedExpenseCount}</strong><span className="mt-1 block text-[10px]" style={muted}>סיווג משפר את ניתוח ההוצאות</span></span>
            <span className="rounded-xl bg-[#547D70]/10 p-3 text-[#547D70]"><ReceiptText className="h-5 w-5" /></span>
          </button>
        </div>
        <p className="mt-3 text-[10px] leading-5" style={muted}>הספירה מבוססת על סטטוס האימות ושדה הקטגוריה ברשומות הקיימות. פתיחת הפנקס מאפשרת לבדוק את העסקאות; הנתונים אינם משתנים אוטומטית.</p>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.2fr_.8fr]">
        <div className={panel + ' p-5 sm:p-7'}>
          <div className="mb-4 flex items-center justify-between gap-3"><div><div className="homeos-section-kicker">LATEST ACTIVITY</div><h2 className="mt-1 text-lg font-bold">פעילות אחרונה</h2></div><button onClick={onOpenLedger} className="homeos-text-link">לכל העסקאות <ArrowLeft className="h-4 w-4" /></button></div>
          {data.recent.length ? <div className="divide-y" style={{ borderColor: activeTheme.borderSubtle }}>{data.recent.map(tx => <button type="button" key={tx.id} onClick={onOpenLedger} title="פתיחת פנקס העסקאות" className="flex w-full items-center justify-between gap-3 py-3.5 text-right transition hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#547D70] dark:hover:bg-white/5"><div className="flex min-w-0 items-center gap-3"><span className={'homeos-transaction-icon ' + (tx.type === 'INCOME' ? 'income' : tx.type === 'TRANSFER' ? '' : 'expense')}>{tx.type === 'INCOME' ? <ArrowDownRight className="h-4 w-4" /> : tx.type === 'TRANSFER' ? <ArrowLeftRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</span><div className="min-w-0"><div className="truncate text-sm font-semibold">{tx.payee || tx.category}</div><div className="mt-1 truncate text-[11px]" style={muted}>{tx.category} · {new Date(tx.date + 'T12:00:00').toLocaleDateString('he-IL')}</div></div></div><strong className={'shrink-0 text-sm tabular-nums ' + (tx.type === 'INCOME' ? 'text-[#477866]' : '')}>{tx.type === 'INCOME' ? '+' : tx.type === 'TRANSFER' ? '↔ ' : '−'}{currency(tx.amountCents)}</strong></button>)}</div> : <div className="py-12 text-center text-sm" style={muted}>עדיין לא נרשמו עסקאות. הפעילות שתזין תופיע כאן.</div>}
        </div>
        <div className={panel + ' p-5 sm:p-7'}>
          <div className="homeos-section-kicker">PORTFOLIO SNAPSHOT</div><h2 className="mt-1 text-lg font-bold">מבט על החשבונות</h2><p className="mt-1 text-xs" style={muted}>היתרות הפעילות במשק הבית</p>
          <div className="mt-5 space-y-3">{data.activeAccounts.slice(0, 4).map(acc => <button type="button" key={acc.id} onClick={onOpenAccounts} title="פתיחת ניהול חשבונות" className="flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-right transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#547D70]" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgSurface }}><div className="flex min-w-0 items-center gap-3"><span className="rounded-xl bg-[#547D70]/10 p-2.5 text-[#547D70]"><PiggyBank className="h-4 w-4" /></span><div className="min-w-0"><div className="truncate text-sm font-semibold">{acc.name}</div><div className="mt-0.5 text-[11px]" style={muted}>{acc.institution}</div></div></div><strong className="shrink-0 text-sm tabular-nums">{currency(acc.currentBalanceCents || 0)}</strong></button>)}</div>
          <button onClick={onOpenAccounts} className="homeos-wide-link mt-4">לכל החשבונות <ChevronLeft className="h-4 w-4" /></button>
        </div>
      </section>

      {chartDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={chartDetail.title} onMouseDown={(event) => { if (event.target === event.currentTarget) setChartDetail(null); }}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-3xl border bg-white shadow-2xl dark:bg-[#1E293B]" style={{ borderColor: activeTheme.borderSubtle }}>
            <div className="flex items-start justify-between gap-4 border-b p-5 sm:p-6" style={{ borderColor: activeTheme.borderSubtle }}>
              <div><div className="homeos-section-kicker">CHART DETAILS</div><h2 className="mt-1 text-xl font-bold">{chartDetail.title}</h2><p className="mt-1 text-sm" style={muted}>{chartDetail.subtitle}</p></div>
              <button type="button" onClick={() => setChartDetail(null)} className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: activeTheme.borderSubtle }}>סגירה ✕</button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-5 sm:p-6">
              {chartDetail.items.length ? <div className="space-y-2">{chartDetail.items.slice().sort((a,b) => b.date.localeCompare(a.date)).map(tx => (
                <div key={tx.id} className="flex items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgSurface }}>
                  <div className="min-w-0"><div className="truncate text-sm font-semibold">{tx.payee || tx.category}</div><div className="mt-1 text-xs" style={muted}>{tx.category} · {new Date(tx.date + 'T12:00:00').toLocaleDateString('he-IL')}</div></div>
                  <strong className={'shrink-0 text-sm tabular-nums ' + (tx.type === 'INCOME' ? 'text-[#477866]' : '')}>{tx.type === 'INCOME' ? '+' : tx.type === 'TRANSFER' ? '↔ ' : '−'}{currency(tx.amountCents)}</strong>
                </div>
              ))}</div> : <div className="py-12 text-center text-sm" style={muted}>אין עסקאות בחודש הזה.</div>}
            </div>
            <div className="border-t p-4 text-left" style={{ borderColor: activeTheme.borderSubtle }}><button type="button" onClick={() => { setChartDetail(null); onOpenLedger(); }} className="homeos-primary-action">פתיחת פנקס העסקאות <ArrowLeft className="h-4 w-4" /></button></div>
          </div>
        </div>
      )}

      <section className="homeos-insight">
        <span className="homeos-insight-icon"><Lightbulb className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">תובנה פיננסית</h2><span className="rounded-full bg-[#547D70]/10 px-2 py-1 text-[10px] font-semibold text-[#547D70]">מבוסס נתונים בפועל</span></div><p className="mt-1 text-sm leading-6" style={muted}>{!hasActivity ? 'עדיין לא נרשמה פעילות החודש. לאחר הזנת עסקאות יופיע כאן ניתוח של התזרים וההוצאות.' : data.cashflow >= 0 ? 'התזרים החודשי כרגע חיובי ועומד על ' + currency(data.cashflow) + (data.topCategories[0] ? '. סעיף ההוצאה הגדול כרגע הוא ' + data.topCategories[0][0] + ' בסך ' + currency(data.topCategories[0][1]) + '. מומלץ לעקוב אחריו עד סוף החודש.' : '. מומלץ להמשיך לעקוב אחר ההוצאות לאורך החודש.') : 'ההוצאות גבוהות מההכנסות שנרשמו החודש ב-' + currency(Math.abs(data.cashflow)) + (data.topCategories[0] ? '. כדאי להתחיל בבדיקת סעיף ' + data.topCategories[0][0] + ' שהוא הגדול כרגע.' : '. כדאי לבדוק את העסקאות האחרונות.')}</p></div>
        <button onClick={onOpenLedger} className="homeos-text-link hidden sm:flex">ניתוח עסקאות <ArrowLeft className="h-4 w-4" /></button>
      </section>
    </div>
  );
};

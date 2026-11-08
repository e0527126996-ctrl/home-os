import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft, ArrowUpLeft, Wallet, Landmark, Activity, TrendingUp,
  TrendingDown, Lightbulb, CalendarDays, Sparkles, ArrowUpRight,
  ArrowDownRight, ArrowLeftRight, ChartNoAxesCombined, ReceiptText, ArrowLeft, CheckCircle2,
  PiggyBank, ShieldCheck, ChevronLeft, CircleDollarSign
} from 'lucide-react';
import { FinancialAccount, LedgerTransaction, HouseholdHomeItem } from '../types.ts';
import { ThemeConfig } from '../lib/themes.ts';
import { buildFinanceAnalytics } from '../lib/financeAnalytics.ts';
import type { WorkspaceViewMode, DashboardWidgetSize } from '../lib/workspace.ts';

interface DashboardViewProps {
  accounts: FinancialAccount[];
  transactions: LedgerTransaction[];
  homeItems: HouseholdHomeItem[];
  householdName: string;
  activeTheme: ThemeConfig;
  onOpenAccounts: () => void;
  onOpenLedger: () => void;
  onOpenHomeTab: (tab: 'planner' | 'shopping' | 'tasks') => void;
  viewMode: WorkspaceViewMode;
  dashboardWidgetOrder: string[];
  visibleDashboardWidgetIds: string[];
  dashboardWidgetSizes: Record<string, DashboardWidgetSize>;
}

const money = (value: number, currency: string = 'ILS') => new Intl.NumberFormat('he-IL', {
  style: 'currency', currency, maximumFractionDigits: 0,
}).format(value);
const monthLabel = (date: Date) => new Intl.DateTimeFormat('he-IL', { month: 'short' }).format(date);

export const DashboardView: React.FC<DashboardViewProps> = ({
  accounts, transactions, homeItems, householdName, activeTheme, onOpenAccounts, onOpenLedger, onOpenHomeTab,
  viewMode, dashboardWidgetOrder, visibleDashboardWidgetIds, dashboardWidgetSizes,
}) => {
  const [chartDetail, setChartDetail] = useState<{ title: string; subtitle: string; items: LedgerTransaction[]; note?: string } | null>(null);
  const [detailFilter, setDetailFilter] = useState<'ALL' | 'INCOME' | 'EXPENSE'>('ALL');
  const detailItems = chartDetail?.items.filter(tx => detailFilter === 'ALL' || tx.type === detailFilter) || [];
  const detailIncome = detailItems.filter(tx => tx.type === 'INCOME').reduce((sum, tx) => sum + tx.amountCents, 0);
  const detailExpense = detailItems.filter(tx => tx.type === 'EXPENSE').reduce((sum, tx) => sum + tx.amountCents, 0);
  const financeAnalytics = useMemo(() => buildFinanceAnalytics(accounts, transactions), [accounts, transactions]);
  const accountCurrencies = useMemo(() => new Map(accounts.map(account => [account.id, account.currency])), [accounts]);
  const detailCurrency = detailItems.length ? (accountCurrencies.get(detailItems[0].accountId) || 'ILS') : 'ILS';
  // All financial views use the same verified transaction selector.
  const confirmedTransactions = useMemo(
    () => financeAnalytics.verifiedTransactions.filter(tx => accountCurrencies.get(tx.accountId) === 'ILS'),
    [financeAnalytics, accountCurrencies],
  );

  useEffect(() => { setDetailFilter('ALL'); }, [chartDetail?.title]);

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
    const assetAccounts = activeAccounts.filter(a => a.currency === 'ILS' && (a.currentBalanceCents || 0) > 0);
    const liabilityAccounts = activeAccounts.filter(a => a.currency === 'ILS' && (a.currentBalanceCents || 0) < 0);
    const assets = assetAccounts.reduce((s, a) => s + (a.currentBalanceCents || 0), 0);
    const liabilities = liabilityAccounts.reduce((s, a) => s + Math.abs(a.currentBalanceCents || 0), 0);
    const now = new Date();
    const months = financeAnalytics.months.slice(-6).map(month => ({
      key: month.key, label: month.label, income: month.incomeCents, expense: month.expenseCents,
    }));
    const currentKey = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
    const current = months.find(m => m.key === currentKey) || { income: 0, expense: 0, label: '' };
    const foreignCurrencySummaries = financeAnalytics.foreignCurrencySummaries.map(item => ({
      currencyCode: item.currency, income: item.incomeCents, expense: item.expenseCents, count: item.count,
    }));
    const previous = months[months.length - 2] || { income: 0, expense: 0, label: '' };
    const currentDay = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const currentMonthTransactions = confirmedTransactions.filter(tx => tx.date?.slice(0, 7) === currentKey && (tx.type === 'INCOME' || tx.type === 'EXPENSE'));
    const currentTransactionDays = new Set(currentMonthTransactions.map(tx => tx.date)).size;
    const projectionReady = currentDay >= 3 && currentTransactionDays >= 3 && currentMonthTransactions.length >= 5;
    const paceFactor = daysInMonth / Math.max(1, currentDay);
    const projectedIncome = Math.round(current.income * paceFactor);
    const projectedExpense = Math.round(current.expense * paceFactor);
    const projectedCashflow = projectedIncome - projectedExpense;
    const expenseToDate = confirmedTransactions.filter(tx => tx.type === 'EXPENSE' && tx.date?.slice(0, 7) === currentKey && Number(tx.date.slice(8, 10)) <= currentDay)
      .reduce((sum, tx) => sum + tx.amountCents, 0);
    const previousExpenseToDate = confirmedTransactions.filter(tx => tx.type === 'EXPENSE' && tx.date?.slice(0, 7) === previous.key && Number(tx.date.slice(8, 10)) <= currentDay)
      .reduce((sum, tx) => sum + tx.amountCents, 0);
    const incomeToDate = currentMonthTransactions.filter(tx => tx.type === 'INCOME')
      .reduce((sum, tx) => sum + tx.amountCents, 0);
    const previousIncomeToDate = confirmedTransactions.filter(tx => tx.type === 'INCOME' && tx.date?.slice(0, 7) === previous.key && Number(tx.date.slice(8, 10)) <= currentDay)
      .reduce((sum, tx) => sum + tx.amountCents, 0);
    const expenseChange = previousExpenseToDate > 0 ? ((expenseToDate - previousExpenseToDate) / previousExpenseToDate) * 100 : null;
    const incomeChange = previousIncomeToDate > 0 ? ((incomeToDate - previousIncomeToDate) / previousIncomeToDate) * 100 : null;
    const max = Math.max(1, ...months.flatMap(m => [m.income, m.expense]));
    const categories = Object.fromEntries(financeAnalytics.categories);
    const topCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]);
    const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
    const completedMonths = months.slice(0, -1).slice(-3);
    // Do not present a three-month baseline when one or more months have no verified activity.
    // The forecast engine owns the minimum-history rule so all dashboard analyses agree.
    const baselineReady = financeAnalytics.forecast.available;
    const baselineMonthCount = baselineReady ? financeAnalytics.forecast.historyMonths : 0;
    const baselineExpense = baselineReady ? financeAnalytics.forecast.averageExpenseCents : 0;
    const baselineIncome = baselineReady ? financeAnalytics.forecast.averageIncomeCents : 0;
    const baselineCashflow = baselineIncome - baselineExpense;
    const baselineSavingsRate = baselineReady && baselineIncome > 0 ? (baselineCashflow / baselineIncome) * 100 : null;
    const baselineTransactionCount = confirmedTransactions.filter(tx => completedMonths.some(m => tx.date?.slice(0, 7) === m.key) && (tx.type === 'INCOME' || tx.type === 'EXPENSE')).length;
    const averageExpense = baselineExpense;
    const cashflow = current.income - current.expense;
    const pendingReviewCount = financeAnalytics.pendingTransactions.length;
    const pendingReviewAmount = financeAnalytics.pendingAmountIlsCents;
    const reconciledTransactionCount = transactions.filter(tx => tx.verificationStatus === 'RECONCILED').length;
    const uncategorizedExpenseCount = transactions.filter(tx => tx.type === 'EXPENSE' && (!tx.category?.trim() || tx.category.trim() === 'ללא קטגוריה')).length;

    // Compare the current month's category run-rate with the average of the prior
    // three complete months. This is a review signal, not a promised saving.
    const savingsInsights = financeAnalytics.spendingAlerts;
    // Surface possible recurring expense patterns from repeated merchant/category activity.
    // This is deliberately a review signal, not proof of a subscription or fixed bill.
    const monthKeys = new Set(months.map(month => month.key));
    const recurringGroups = new Map<string, { payee: string; category: string; monthlyAmounts: Map<string, number>; items: LedgerTransaction[] }>();
    for (const tx of confirmedTransactions) {
      if (tx.type !== 'EXPENSE' || tx.verificationStatus === 'PENDING' || !tx.date || !monthKeys.has(tx.date.slice(0, 7)) || !tx.payee?.trim() || !Number.isSafeInteger(tx.amountCents) || tx.amountCents <= 0) continue;
      const payee = tx.payee.trim().replace(/\s+/g, ' ');
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

    return { assets, liabilities, netWorth: assets - liabilities, months, max, current, previous, expenseChange, incomeChange, topCategories, recent, activeAccounts, assetAccountCount: assetAccounts.length, liabilityAccountCount: liabilityAccounts.length, foreignAccountCount: activeAccounts.filter(a => a.currency !== 'ILS').length, foreignCurrencySummaries, averageExpense, cashflow, baselineExpense, baselineIncome, baselineCashflow, baselineSavingsRate, baselineTransactionCount, baselineMonthCount, currentDay, daysInMonth, currentTransactionDays, projectionReady, projectedIncome, projectedExpense, projectedCashflow, savingsInsights, recurringExpenses, pendingReviewCount, pendingReviewAmount, reconciledTransactionCount, uncategorizedExpenseCount };
  }, [accounts, transactions, confirmedTransactions, accountCurrencies, financeAnalytics]);

  const today = new Date();
  const todayKey = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, '0'), String(today.getDate()).padStart(2, '0')].join('-');
  const nextWeekDate = new Date(today);
  nextWeekDate.setDate(nextWeekDate.getDate() + 7);
  const nextWeekKey = [nextWeekDate.getFullYear(), String(nextWeekDate.getMonth() + 1).padStart(2, '0'), String(nextWeekDate.getDate()).padStart(2, '0')].join('-');
  const householdSnapshot = useMemo(() => {
    const meals = homeItems.filter(item => item.kind === 'meal' && String(item.data.date || '') >= todayKey && String(item.data.date || '') <= nextWeekKey);
    const openTasks = homeItems.filter(item => item.kind === 'task' && !Boolean(item.data.done));
    const openShopping = homeItems.filter(item => item.kind === 'shopping' && !Boolean(item.data.checked));
    const overdueTasks = openTasks
      .filter(item => Boolean(item.data.dueDate) && String(item.data.dueDate) < todayKey)
      .sort((a, b) => String(a.data.dueDate).localeCompare(String(b.data.dueDate)));
    const upcomingTask = openTasks
      .filter(item => Boolean(item.data.dueDate) && String(item.data.dueDate) >= todayKey)
      .sort((a, b) => String(a.data.dueDate).localeCompare(String(b.data.dueDate)))[0] || null;
    return {
      meals: meals.length,
      openTasks: openTasks.length,
      openShopping: openShopping.length,
      overdueTasks: overdueTasks.length,
      firstOverdueTask: overdueTasks[0] || null,
      upcomingTask,
    };
  }, [homeItems, todayKey, nextWeekKey]);
  const currency = (cents: number, currencyCode: string = 'ILS') => money(cents / 100, currencyCode);
  const muted = { color: activeTheme.textSecondary };
  const panel = 'homeos-lux-panel';
  const widgetOrderStyle = (id: string): React.CSSProperties => ({ order: Math.max(0, dashboardWidgetOrder.indexOf(id)) });
  const widgetVisible = (id: string) => visibleDashboardWidgetIds.includes(id);
  const widgetSize = (id: string) => dashboardWidgetSizes[id] || 'standard';
  const widgetAttributes = (id: string) => ({ 'data-widget-id': id, 'data-widget-size': widgetSize(id), hidden: !widgetVisible(id), style: widgetOrderStyle(id) });
  const categoryTotal = data.topCategories.reduce((sum, item) => sum + item[1], 0);
  const categoryColors = [activeTheme.accent, activeTheme.isDark ? '#A3B7C8' : activeTheme.accentMuted, '#8295A7', '#A97972', '#9C9A7D'];
  const monthName = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(new Date());
  const viewModeTitle = viewMode === 'executive' ? 'Executive · מנהלים' : viewMode === 'productivity' ? 'Productivity · עבודה שוטפת' : 'Analytics · אנליטיקה';
  const hasActivity = data.current.income > 0 || data.current.expense > 0;
  const hasVerifiedHistory = data.months.some(month => month.income > 0 || month.expense > 0);
  const prioritySignals = [
    ...(data.pendingReviewCount > 0 ? [{
      id: 'pending',
      tone: 'warning',
      eyebrow: 'בקרת נתונים',
      title: 'עסקאות ממתינות לאימות',
      value: data.pendingReviewCount.toLocaleString('he-IL'),
      description: currency(data.pendingReviewAmount) + ' עדיין לא נכללו ביתרות ובניתוחים',
      action: 'בדיקה ואימות',
      onClick: onOpenLedger,
    }] : []),
    ...(householdSnapshot.overdueTasks > 0 ? [{
      id: 'overdue',
      tone: 'warning',
      eyebrow: 'ניהול הבית',
      title: 'משימות שעבר מועד הביצוע שלהן',
      value: householdSnapshot.overdueTasks.toLocaleString('he-IL'),
      description: String(householdSnapshot.firstOverdueTask?.data.title || 'יש משימות שמחכות לטיפול'),
      action: 'פתיחת המשימות',
      onClick: () => onOpenHomeTab('tasks'),
    }] : []),
    ...(data.uncategorizedExpenseCount > 0 ? [{
      id: 'uncategorized',
      tone: 'review',
      eyebrow: 'סדר פיננסי',
      title: 'הוצאות ללא קטגוריה',
      value: data.uncategorizedExpenseCount.toLocaleString('he-IL'),
      description: 'סיווג העסקאות ישפר את איכות הפילוח והניתוח',
      action: 'סיווג בפנקס',
      onClick: onOpenLedger,
    }] : []),
    ...(!hasVerifiedHistory ? [{
      id: 'history',
      tone: 'neutral',
      eyebrow: 'השלב הבא',
      title: 'בוא נבנה תמונת מצב אמינה',
      value: '01',
      description: 'אמת עסקאות או הוסף תנועות כדי להתחיל לראות מגמות ותזרים',
      action: 'פתיחת פנקס העסקאות',
      onClick: onOpenLedger,
    }] : []),
    ...(householdSnapshot.openShopping > 0 ? [{
      id: 'shopping',
      tone: 'neutral',
      eyebrow: 'תפעול הבית',
      title: 'רשימת הקניות עדיין פתוחה',
      value: householdSnapshot.openShopping.toLocaleString('he-IL'),
      description: 'פריטים שממתינים לאיסוף',
      action: 'פתיחת הרשימה',
      onClick: () => onOpenHomeTab('shopping'),
    }] : []),
  ].slice(0, 4);

  // Coordinates are derived exclusively from the same verified six-month series used by the KPI layer.
  const cashflowChartPoints = data.months.map((month, index) => ({
    ...month,
    x: data.months.length < 2 ? 300 : 24 + (index / (data.months.length - 1)) * 552,
    incomeY: 190 - (month.income / data.max) * 150,
    expenseY: 190 - (month.expense / data.max) * 150,
  }));
  const smoothChartLine = (field: 'incomeY' | 'expenseY') => {
    if (!cashflowChartPoints.length) return '';
    return cashflowChartPoints.slice(1).reduce((path, point, index) => {
      const previousPoint = cashflowChartPoints[index];
      const midpoint = (previousPoint.x + point.x) / 2;
      return path + ' C ' + midpoint + ' ' + previousPoint[field] + ', ' + midpoint + ' ' + point[field] + ', ' + point.x + ' ' + point[field];
    }, 'M ' + cashflowChartPoints[0].x + ' ' + cashflowChartPoints[0][field]);
  };
  const incomeLinePath = smoothChartLine('incomeY');
  const expenseLinePath = smoothChartLine('expenseY');
  const incomeAreaPath = cashflowChartPoints.length ? incomeLinePath + ' L ' + cashflowChartPoints[cashflowChartPoints.length - 1].x + ' 194 L ' + cashflowChartPoints[0].x + ' 194 Z' : '';
  const expenseAreaPath = cashflowChartPoints.length ? expenseLinePath + ' L ' + cashflowChartPoints[cashflowChartPoints.length - 1].x + ' 194 L ' + cashflowChartPoints[0].x + ' 194 Z' : '';

  return (
    <div className="homeos-dashboard homeos-command-center homeos-dashboard-atlas space-y-6 pb-10" dir="rtl" data-view-mode={viewMode}>
      <header className="homeos-dashboard-heading homeos-command-masthead">
        <div className="homeos-command-masthead-copy">
          <div className="homeos-page-eyebrow"><span className="homeos-page-eyebrow-mark" /> HOME OS <span className="homeos-page-breadcrumb">/ COMMAND CENTER</span></div>
          <h1>הבית שלך. <em>תחת שליטה.</em></h1>
          <p>מרכז הניהול של <strong>{householdName || 'משק הבית'}</strong> — תמונת הון, תזרים, חריגות והפעולות שדורשות תשומת לב.</p>
        </div>
        <div className="homeos-command-masthead-tools">
          <div className="homeos-command-meta">
            <span className="homeos-command-mode">{viewModeTitle}</span>
            <span className="homeos-command-date"><CalendarDays className="h-4 w-4" /> {monthName}</span>
          </div>
          <div className="homeos-command-actions">
            <button onClick={onOpenLedger} className="homeos-primary-action"><ReceiptText className="h-4 w-4" /> רישום ובדיקת עסקאות</button>
            <button onClick={onOpenAccounts} className="homeos-secondary-action"><Landmark className="h-4 w-4" /> חשבונות ונכסים</button>
          </div>
          <span className="homeos-command-integrity"><ShieldCheck className="h-3.5 w-3.5" /> נתונים מאומתים וממתינים מוצגים בנפרד</span>
        </div>
      </header>

      <section className="homeos-wealth-hero homeos-portfolio-hero homeos-atlas-wealth" {...widgetAttributes('net-worth')}>
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
            <p className="mt-4 max-w-xl text-sm leading-7 text-white/55">תמונת ההון בשקלים בלבד. חשבונות במטבע זר מוצגים במטבע המקורי ואינם מומרים ללא שער חליפין מאומת.{data.foreignAccountCount > 0 ? ' קיימים ' + data.foreignAccountCount + ' חשבונות במטבע זר.' : ''}</p>
            <div className="mt-7 flex flex-wrap items-center gap-3">
              <button onClick={onOpenAccounts} className="homeos-hero-button">סקירת הנכסים <ChevronLeft className="h-4 w-4" /></button>
              <span className="flex items-center gap-2 text-xs text-white/45"><ShieldCheck className="h-4 w-4 text-[#B7C9B8]" /> נתונים מקומיים ומאובטחים במכשיר</span>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 xl:grid-cols-1">
            <button type="button" onClick={onOpenAccounts} className="homeos-hero-metric" title="פתיחת חשבונות הנכסים"><span className="homeos-metric-icon"><TrendingUp className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="text-xs text-white/50">נכסים</div><div className="mt-1 text-xl font-semibold tabular-nums text-white">{currency(data.assets)}</div></div><span className="text-[10px] text-white/35">{data.assetAccountCount} חשבונות · פתיחה</span></button>
            <button type="button" onClick={onOpenAccounts} className="homeos-hero-metric" title="פתיחת חשבונות ההתחייבויות"><span className="homeos-metric-icon copper"><TrendingDown className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="text-xs text-white/50">התחייבויות</div><div className="mt-1 text-xl font-semibold tabular-nums text-white">{currency(data.liabilities)}</div></div><span className="text-[10px] text-white/35">{data.liabilityAccountCount} התחייבויות · פתיחה</span></button>
            <button type="button" onClick={onOpenLedger} className="homeos-hero-metric" title="פתיחת תנועות החודש"><span className="homeos-metric-icon blue"><Activity className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="text-xs text-white/50">תזרים החודש</div><div className="mt-1 text-xl font-semibold tabular-nums text-white">{currency(data.cashflow)}</div></div><span className="text-[10px] text-white/35">הכנסות פחות הוצאות · פירוט</span></button>
          </div>
        </div>
        <div className="homeos-hero-footer"><span>תמונת ההון של משק הבית</span><span>01 — מצב פיננסי</span></div>
      </section>

      <section className="homeos-kpi-strip homeos-atlas-kpis" aria-label="מדדי החודש" {...widgetAttributes('monthly-kpis')}>
        <button type="button" onClick={() => setChartDetail({ title: "הכנסות החודש", subtitle: "כל ההכנסות שנרשמו בחודש הנוכחי", items: confirmedTransactions.filter(tx => tx.type === 'INCOME' && tx.date?.slice(0, 7) === data.months[5]?.key) })} className="homeos-kpi-item"><div className="homeos-card-top"><span>הכנסות החודש</span><span className="homeos-icon-tile green"><ArrowDownLeft className="h-5 w-5" /></span></div><div className="homeos-kpi-value green">{currency(data.current.income)}</div><div className="homeos-card-foot">לחץ לפירוט ההכנסות</div>{data.incomeChange !== null && <div className={'homeos-kpi-delta ' + (data.incomeChange >= 0 ? 'is-positive' : 'is-negative')} data-direction={data.incomeChange >= 0 ? 'up' : 'down'}><span>{data.incomeChange > 0 ? '↑' : data.incomeChange < 0 ? '↓' : '→'}</span>{data.incomeChange > 0 ? '+' : ''}{data.incomeChange.toFixed(1)}% <small>מול אותם ימים בחודש הקודם</small></div>}</button>
        <button type="button" onClick={() => setChartDetail({ title: "הוצאות החודש", subtitle: "כל ההוצאות שנרשמו בחודש הנוכחי", items: confirmedTransactions.filter(tx => tx.type === 'EXPENSE' && tx.date?.slice(0, 7) === data.months[5]?.key) })} className="homeos-kpi-item"><div className="homeos-card-top"><span>הוצאות החודש</span><span className="homeos-icon-tile copper"><ArrowUpLeft className="h-5 w-5" /></span></div><div className="homeos-kpi-value">{currency(data.current.expense)}</div><div className="homeos-card-foot">לחץ לפירוט ההוצאות</div></button>
        <button type="button" onClick={() => setChartDetail({ title: "מאזן חודשי", subtitle: "הכנסות והוצאות בחודש הנוכחי", items: confirmedTransactions.filter(tx => tx.date?.slice(0, 7) === data.months[5]?.key && (tx.type === 'INCOME' || tx.type === 'EXPENSE')) })} className="homeos-kpi-item"><div className="homeos-card-top"><span>מאזן חודשי</span><span className="homeos-icon-tile blue"><Activity className="h-5 w-5" /></span></div><div className={'homeos-kpi-value ' + (data.cashflow >= 0 ? 'green' : 'negative')}>{currency(data.cashflow)}</div><div className="homeos-card-foot">לחץ לפירוט התזרים</div></button>
        <button type="button" onClick={() => setChartDetail({ title: "השוואת הוצאות חודשית", subtitle: "עסקאות הוצאה בחודש הנוכחי ובחודש הקודם", items: confirmedTransactions.filter(tx => tx.type === 'EXPENSE' && [data.months[5]?.key, data.months[4]?.key].includes(tx.date?.slice(0, 7))) })} className="homeos-kpi-item"><div className="homeos-card-top"><span>שינוי בהוצאות</span><span className="homeos-icon-tile neutral"><CalendarDays className="h-5 w-5" /></span></div><div className={'homeos-kpi-value ' + (data.expenseChange === null ? '' : data.expenseChange > 0 ? 'negative' : 'green')}>{data.expenseChange === null ? '—' : ((data.expenseChange > 0 ? '↑ +' : data.expenseChange < 0 ? '↓ ' : '→ ') + data.expenseChange.toFixed(1) + '%')}</div><div className="homeos-card-foot">השוואה לאותם ימים בחודש הקודם · לחץ לפירוט</div></button>
      </section>

      {data.pendingReviewCount > 0 && (
        <aside className="homeos-data-notice" role="status">
          <strong>יש {data.pendingReviewCount} עסקאות שממתינות לאימות.</strong>
          {' '}סכום ממתין בשקלים: <strong>{currency(data.pendingReviewAmount)}</strong>. העסקאות נשמרו בפנקס, אך לא ייכנסו לגרפים, לתחזיות וליתרות עד לאימות. לאחר האימות הנתונים יתעדכנו אוטומטית בכל התצוגות.
        </aside>
      )}

      <section className="homeos-action-center homeos-atlas-actions" aria-label="מוקדי תשומת לב ופעולות מומלצות">
        <div className="homeos-action-center-heading">
          <div>
            <div className="homeos-section-kicker">NEXT BEST ACTIONS</div>
            <h2>מה דורש תשומת לב עכשיו?</h2>
            <p>רשימת פעולות שנבנתה מהנתונים הקיימים, בלי לנחש ובלי להציג מספרים חסרים.</p>
          </div>
          <span className="homeos-action-center-count">{prioritySignals.length ? prioritySignals.length + ' נושאים למעקב' : 'הכול מסודר כרגע'}</span>
        </div>
        {prioritySignals.length ? (
          <div className="homeos-action-center-grid">
            {prioritySignals.map(signal => (
              <button type="button" key={signal.id} onClick={signal.onClick} className={"homeos-action-signal is-" + signal.tone}>
                <span className="homeos-action-signal-top"><small>{signal.eyebrow}</small><strong>{signal.value}</strong></span>
                <span className="homeos-action-signal-title">{signal.title}</span>
                <span className="homeos-action-signal-description">{signal.description}</span>
                <span className="homeos-action-signal-link">{signal.action}<ArrowLeft className="h-3.5 w-3.5"/></span>
              </button>
            ))}
          </div>
        ) : (
          <div className="homeos-action-center-clear">
            <span className="homeos-action-center-clear-icon"><CheckCircle2 className="h-5 w-5"/></span>
            <div><strong>אין כרגע פעולות דחופות שזוהו</strong><p>המשך לעקוב אחר התזרים והפעילות. אזור זה יתעדכן עם כניסת נתונים חדשים.</p></div>
          </div>
        )}
      </section>

      <section className="homeos-analysis-grid grid gap-5 xl:grid-cols-[1.55fr_.85fr]" {...widgetAttributes('cashflow-analysis')}>
        <div className={panel + ' p-5 sm:p-7'}>
          <div className="mb-7 flex flex-wrap items-start justify-between gap-3">
            <div><div className="homeos-section-kicker">ניתוח תזרים מזומנים</div><h2 className="mt-1 text-lg font-bold">תנועת הכסף לאורך זמן</h2><p className="mt-1 text-xs" style={muted}>השוואת הכנסות והוצאות · ששת החודשים האחרונים</p></div>
            <div className="flex gap-4 text-[11px]" style={muted}><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#547D70]" /> הכנסות</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-full bg-[#C49A69]" /> הוצאות</span></div>
          </div>
          {hasVerifiedHistory ? <div className="homeos-terminal-chart">
            <div className="homeos-terminal-chart-topline">
              <span>מגמה חודשית · ₪</span>
              <span>שישה חודשים אחרונים</span>
            </div>
            <svg className="homeos-terminal-area-chart" viewBox="0 0 600 220" role="img" aria-label="גרף שטח של הכנסות והוצאות מאומתות בששת החודשים האחרונים">
              <defs>
                <linearGradient id="homeos-income-gradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#16866C" stopOpacity=".28" />
                  <stop offset="100%" stopColor="#16866C" stopOpacity=".015" />
                </linearGradient>
                <linearGradient id="homeos-expense-gradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#B66B63" stopOpacity=".2" />
                  <stop offset="100%" stopColor="#B66B63" stopOpacity=".012" />
                </linearGradient>
              </defs>
              <path d={expenseAreaPath} fill="url(#homeos-expense-gradient)" />
              <path d={incomeAreaPath} fill="url(#homeos-income-gradient)" />
              <path d={expenseLinePath} className="homeos-terminal-line expense" fill="none" />
              <path d={incomeLinePath} className="homeos-terminal-line income" fill="none" />
              {cashflowChartPoints.map((point, index) => <g key={point.key}>
                <circle cx={point.x} cy={point.expenseY} r={index === cashflowChartPoints.length - 1 ? 4 : 2.8} className="homeos-terminal-point expense"><title>{point.label} · הוצאות: {currency(point.expense)}</title></circle>
                <circle cx={point.x} cy={point.incomeY} r={index === cashflowChartPoints.length - 1 ? 4 : 2.8} className="homeos-terminal-point income"><title>{point.label} · הכנסות: {currency(point.income)}</title></circle>
              </g>)}
            </svg>
            <div className="homeos-terminal-months" role="group" aria-label="בחירת חודש להצגת עסקאות">
              {data.months.map(month => (
                <button type="button" key={month.key} className="homeos-terminal-month" aria-label={"פתיחת פירוט " + month.label} onClick={() => setChartDetail({ title: "פירוט " + month.label, subtitle: "הכנסות " + currency(month.income) + " · הוצאות " + currency(month.expense), items: confirmedTransactions.filter(tx => tx.date && tx.date.slice(0, 7) === month.key && (tx.type === 'INCOME' || tx.type === 'EXPENSE')) })}>
                  <span>{month.label}</span>
                  <strong>{currency(month.income - month.expense)}</strong>
                </button>
              ))}
            </div>
          </div> : <div className="flex min-h-[230px] flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-8 text-center" style={{borderColor:activeTheme.borderSubtle,backgroundColor:activeTheme.bgSurface}}>
            <ChartNoAxesCombined className="mb-3 h-8 w-8" style={{color:activeTheme.accent}} />
            <strong className="text-sm">{data.pendingReviewCount > 0 ? 'העסקאות עדיין ממתינות לאימות' : 'עדיין אין נתונים מאומתים להצגת גרף'}</strong>
            <p className="mt-2 max-w-md text-xs leading-6" style={muted}>{data.pendingReviewCount > 0 ? 'נמצאו ' + data.pendingReviewCount + ' עסקאות ממתינות. פתח את פנקס העסקאות, בדוק כל שורה מול דף החשבון ולחץ על ״אמת״ כדי לכלול אותה ביתרות ובגרפים.' : 'ייבא דף חשבון או הוסף עסקאות, בדוק אותן בפנקס ואמת אותן. לאחר האימות הגרפים יתמלאו אוטומטית.'}</p>
            <button type="button" onClick={onOpenLedger} className="homeos-primary-action mt-4">מעבר לפנקס ואימות עסקאות <ArrowLeft className="h-4 w-4" /></button>
          </div>}
          <div className="mt-5 grid grid-cols-2 gap-4 border-t pt-5" style={{ borderColor: activeTheme.borderSubtle }}>
            <div><div className="text-[11px]" style={muted}>מאזן החודש</div><div className="mt-1 text-lg font-bold tabular-nums" style={{ color: data.cashflow >= 0 ? activeTheme.accent : '#B45F56' }}>{currency(data.cashflow)}</div></div>
            <div><div className="text-[11px]" style={muted}>ממוצע הוצאות · 3 חודשים מלאים</div><div className="mt-1 text-lg font-bold tabular-nums">{currency(data.averageExpense)}</div></div>
          </div>
        </div>

        <div className={panel + ' p-5 sm:p-7'}>
          <div className="homeos-section-kicker">פילוח הוצאות</div><h2 className="mt-1 text-lg font-bold">לאן הכסף הולך?</h2><p className="mt-1 text-xs" style={muted}>כל קטגוריות ההוצאה בחודש הנוכחי</p>
          {data.topCategories.length ? <><div className="my-6 flex items-center justify-center"><svg className="homeos-category-donut" viewBox="0 0 220 220" role="group" aria-label="פילוח הוצאות לפי קטגוריה, ניתן לבחור מקטע לפירוט"><circle cx="110" cy="110" r="76" fill="none" stroke={activeTheme.borderSubtle} strokeWidth="28" />{data.topCategories.map(([name, value], i) => { const circumference = 2 * Math.PI * 76; const segment = categoryTotal ? value / categoryTotal * circumference : 0; const offset = data.topCategories.slice(0, i).reduce((sum, item) => sum + item[1], 0) / Math.max(1, categoryTotal) * circumference; const openCategory = () => setChartDetail({ title: "הוצאות: " + name, subtitle: "עסקאות בקטגוריה זו בחודש הנוכחי · " + currency(value), items: confirmedTransactions.filter(tx => tx.type === 'EXPENSE' && (tx.category?.trim() || 'ללא קטגוריה') === name && tx.date?.slice(0, 7) === data.months[5]?.key) }); return <circle key={name} cx="110" cy="110" r="76" fill="none" stroke={categoryColors[i % categoryColors.length]} strokeWidth="28" strokeDasharray={segment + " " + Math.max(0, circumference - segment)} strokeDashoffset={-offset} transform="rotate(-90 110 110)" role="button" tabIndex={0} aria-label={"פירוט הוצאות " + name + " " + currency(value)} onClick={openCategory} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openCategory(); } }} className="homeos-category-donut-segment"><title>{name}: {currency(value)} — לחיצה לפירוט</title></circle>; })}<text x="110" y="101" textAnchor="middle" className="homeos-category-donut-caption">כל הקטגוריות</text><text x="110" y="126" textAnchor="middle" className="homeos-category-donut-total">{currency(categoryTotal)}</text></svg></div><div className="space-y-3">{data.topCategories.map(([name, value], i) => <button type="button" key={name} onClick={() => setChartDetail({ title: "הוצאות: " + name, subtitle: "עסקאות בקטגוריה זו בחודש הנוכחי · " + currency(value), items: confirmedTransactions.filter(tx => tx.type === 'EXPENSE' && (tx.category?.trim() || 'ללא קטגוריה') === name && tx.date?.slice(0, 7) === data.months[5]?.key) })} className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-right text-xs transition hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-[#547D70] dark:hover:bg-white/10"><span className="flex min-w-0 items-center gap-2"><i className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: categoryColors[i % categoryColors.length] }} /><span className="truncate">{name}</span></span><strong className="shrink-0 tabular-nums">{currency(value)}</strong></button>)}</div></> : <div className="flex min-h-52 flex-col items-center justify-center text-center"><Sparkles className="mb-3 h-7 w-7" style={muted} /><p className="text-sm font-semibold">אין עדיין נתוני הוצאות</p><p className="mt-1 max-w-[220px] text-xs leading-5" style={muted}>לאחר רישום עסקאות יוצג כאן ניתוח לפי קטגוריות.</p></div>}
        </div>
      </section>

      <section className={panel + ' p-5 sm:p-7'} {...widgetAttributes('cashflow-forecast')}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="homeos-section-kicker">תחזית תזרים רב-חודשית</div>
            <h2 className="mt-1 text-lg font-bold">מבט קדימה · 12 חודשים</h2>
            <p className="mt-1 text-xs" style={muted}>תרחיש בסיס לפי ממוצע של שלושת החודשים המלאים האחרונים, ללא הנחת הכנסות או חיובים עתידיים שלא נרשמו.</p>
          </div>
          <span className="rounded-full bg-[#547D70]/10 px-3 py-1.5 text-[10px] font-semibold text-[#547D70]">תחזית תרחישית</span>
        </div>
        {financeAnalytics.forecast.available ? <>
          <div className="mt-5 grid gap-3 sm:grid-cols-3">
            {financeAnalytics.forecast.horizons.map(item => (
              <div key={item.months} className="rounded-2xl border p-4" style={{borderColor:activeTheme.borderSubtle,backgroundColor:activeTheme.bgSurface}}>
                <div className="text-xs" style={muted}>תזרים מצטבר חזוי · {item.months} חודשים</div>
                <div className={'mt-2 text-xl font-bold tabular-nums ' + (item.netCents >= 0 ? 'text-[#477866]' : 'text-[#B45F56]')}>{currency(item.netCents)}</div>
                <div className="mt-1 text-[10px]" style={muted}>הכנסות {currency(item.incomeCents)} · הוצאות {currency(item.expenseCents)}</div>
              </div>
            ))}
          </div>
          <div className="mt-6 grid grid-cols-6 gap-2 sm:grid-cols-12">
            {financeAnalytics.forecast.monthly.map(month => {
              const maxCumulative = Math.max(1, ...financeAnalytics.forecast.monthly.map(point => Math.abs(point.cumulativeNetCents)));
              const height = Math.max(4, Math.abs(month.cumulativeNetCents) / maxCumulative * 100);
              return <button type="button" key={month.key} className="homeos-forecast-month flex min-w-0 flex-col items-center gap-2 rounded-lg px-1 text-center" title={month.label + ': ' + currency(month.cumulativeNetCents) + ' · לחיצה לפרטי התחזית'} onClick={() => setChartDetail({ title: "תחזית תזרים — " + month.label, subtitle: "תזרים מצטבר חזוי: " + currency(month.cumulativeNetCents), items: [], note: "זהו ערך תרחישי ולא תנועה שנרשמה בפועל. התחזית מחושבת מנתוני הכנסה והוצאה מאומתים משלושת החודשים המלאים האחרונים ומניחה שהקצב הממוצע יימשך. כדי לבדוק את נתוני המקור, פתח את פנקס העסקאות." })}>
                <div className="flex h-28 w-full items-end justify-center rounded-lg px-1" style={{backgroundColor:activeTheme.bgSurface}}>
                  <div className="w-full rounded-t-md" style={{height:height + '%',background:month.cumulativeNetCents >= 0 ? 'linear-gradient(180deg,#6F9B83,#477866)' : 'linear-gradient(180deg,#D08A7D,#B45F56)'}}/>
                </div>
                <span className="text-[9px] whitespace-nowrap" style={muted}>{month.label}</span>
              </button>;
            })}
          </div>
          <p className="mt-3 text-[10px] leading-5" style={muted}>רמת ביטחון: {financeAnalytics.forecast.confidence === 'good' ? 'טובה' : 'בינונית'} · מבוסס על {financeAnalytics.forecast.historyTransactions} עסקאות מאומתות בשלושה חודשים מלאים. זהו תרחיש קבוע ולא תחזית עונתית; יש להוסיף ידנית התחייבויות, שינויים בשכר והוצאות חריגות כדי לדייק אותו.</p>
        </> : <div className="mt-5 rounded-2xl border p-5 text-sm leading-6" style={{borderColor:activeTheme.borderSubtle,backgroundColor:activeTheme.bgSurface,color:activeTheme.textSecondary}}>
          עדיין אין מספיק היסטוריה רציפה לתחזית אחראית. נדרשות לפחות 9 עסקאות מאומתות הפרוסות על פני שלושת החודשים המלאים האחרונים. בינתיים לא נציג מספרים מומצאים.
        </div>}
      </section>

      <details className="homeos-advanced-details" open={viewMode === 'analytics'} {...widgetAttributes('advanced-analysis')}>
        <summary>
          <span className="homeos-advanced-title">ניתוח מתקדם</span>
          <span className="homeos-advanced-description">תחזיות, הזדמנויות לחיסכון ובקרת נתונים</span>
          <ChevronLeft className="homeos-advanced-chevron h-4 w-4" />
        </summary>
        <div className="homeos-advanced-content space-y-5">
      <section className={panel + ' p-5 sm:p-7'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="homeos-section-kicker">תחזית משק הבית</div>
            <h2 className="mt-1 text-lg font-bold">תחזית חודשית ותכנון קדימה</h2>
            <p className="mt-1 text-xs" style={muted}>ממוצעים היסטוריים לצד תחזית קצב לחודש הנוכחי — לא התחייבות לתוצאה.</p>
          </div>
          <span className="rounded-full bg-[#547D70]/10 px-3 py-1.5 text-[10px] font-semibold text-[#547D70]">מבוסס היסטוריה בפועל</span>
        </div>
        {financeAnalytics.forecast.available ? (
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
            <div className="homeos-section-kicker">בדיקת הזדמנויות לחיסכון</div>
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
                <button type="button" onClick={() => setChartDetail({ title: "בדיקת הוצאות: " + item.category, subtitle: "עסקאות בקטגוריה בחודש הנוכחי", items: confirmedTransactions.filter(tx => tx.type === 'EXPENSE' && (tx.category || 'ללא קטגוריה') === item.category && tx.date?.slice(0, 7) === data.months[5]?.key) })} className="homeos-text-link mt-3">בדיקת העסקאות <ArrowLeft className="h-4 w-4" /></button>
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
            <div className="homeos-section-kicker">דפוסי הוצאות חוזרים</div>
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
                <div className="mt-3 border-t pt-2 text-[10px]" style={{ borderColor: activeTheme.borderSubtle, color: item.currentMonthAmount > 0 ? activeTheme.accent : activeTheme.textSecondary }}>{item.currentMonthAmount > 0 ? 'נרשם החודש: ' + currency(item.currentMonthAmount) : 'טרם נרשם החודש'}</div>
              </button>
            ))}
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border p-4 text-sm leading-6" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgSurface, color: activeTheme.textSecondary }}>עדיין לא זוהו דפוסים חוזרים שעומדים בסף. נדרש ספק או תיאור שחוזר בלפחות 3 חודשים, עם סכומים בטווח דומה.</div>
        )}
        <p className="mt-3 text-[10px] leading-5" style={muted}>הזיהוי מבוסס על עסקאות מאומתות בלבד, התאמה בין שם הספק והקטגוריה ועל סכומים דומים. ייתכן שמדובר בקניות חוזרות ולא במנוי או בהוראת קבע; לחיצה פותחת את העסקאות שעליהן מבוסס הזיהוי.</p>
      </section>

      <section className={panel + ' p-5 sm:p-7'}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="homeos-section-kicker">בקרת איכות נתונים</div>
            <h2 className="mt-1 text-lg font-bold">בקרת איכות נתוני העסקאות</h2>
            <p className="mt-1 text-xs" style={muted}>כדאי להשלים בדיקות לפני שמסתמכים על הניתוחים והתחזיות</p>
          </div>
          <span className="rounded-full bg-[#547D70]/10 px-3 py-1.5 text-[10px] font-semibold text-[#547D70]">בדיקה אוטומטית</span>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <button type="button" onClick={onOpenLedger} className="flex items-center justify-between gap-3 rounded-2xl border p-4 text-right transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgSurface }}>
            <span><span className="block text-xs" style={muted}>עסקאות שממתינות לאימות</span><strong className="mt-1 block text-2xl tabular-nums">{data.pendingReviewCount}</strong><span className="mt-1 block text-[10px]" style={muted}>בדוק ואמת נתונים שיובאו</span></span>
            <span className="rounded-xl bg-[#B98B58]/10 p-3 text-[#B98B58]"><ShieldCheck className="h-5 w-5" /></span>
          </button>
          <button type="button" onClick={onOpenLedger} className="flex items-center justify-between gap-3 rounded-2xl border p-4 text-right transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgSurface }}>
            <span><span className="block text-xs" style={muted}>הוצאות ללא קטגוריה</span><strong className="mt-1 block text-2xl tabular-nums">{data.uncategorizedExpenseCount}</strong><span className="mt-1 block text-[10px]" style={muted}>סיווג משפר את ניתוח ההוצאות</span></span>
            <span className="rounded-xl bg-[#547D70]/10 p-3 text-[#547D70]"><ReceiptText className="h-5 w-5" /></span>
          </button>
          <button type="button" onClick={onOpenLedger} className="flex items-center justify-between gap-3 rounded-2xl border p-4 text-right transition hover:-translate-y-0.5 hover:shadow-md" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgSurface }}>
            <span><span className="block text-xs" style={muted}>עסקאות מותאמות לדף חשבון</span><strong className="mt-1 block text-2xl tabular-nums">{data.reconciledTransactionCount}</strong><span className="mt-1 block text-[10px]" style={muted}>התאמה ואימות מול מסמך חיצוני</span></span>
            <span className="rounded-xl bg-blue-500/10 p-3 text-blue-700"><CheckCircle2 className="h-5 w-5" /></span>
          </button>
        </div>
        <p className="mt-3 text-[10px] leading-5" style={muted}>הספירה מבוססת על סטטוס האימות ושדה הקטגוריה ברשומות הקיימות. פתיחת הפנקס מאפשרת לבדוק את העסקאות; הנתונים אינם משתנים אוטומטית.</p>
      </section>

        </div>
      </details>

      {data.foreignCurrencySummaries.length > 0 && (
        <section className="homeos-foreign-currency" {...widgetAttributes('foreign-currency')}>
          <div className="mb-4"><div className="homeos-section-kicker">פעילות לפי מטבע</div><h2 className="mt-1 text-lg font-bold">חשבונות במטבע זר</h2><p className="mt-1 text-xs" style={muted}>הכנסות והוצאות מוצגות בנפרד לכל מטבע, ללא המרה משוערת לשקלים</p></div>
          <div className="space-y-4">
            {data.foreignCurrencySummaries.map(item => {
              const maxAmount = Math.max(1, item.income, item.expense);
              return <button type="button" key={item.currencyCode} className="homeos-foreign-row homeos-foreign-row-button" title={"פתיחת עסקאות במטבע " + item.currencyCode} onClick={() => setChartDetail({ title: "פעילות בחשבונות " + item.currencyCode, subtitle: "הכנסות " + currency(item.income, item.currencyCode) + " · הוצאות " + currency(item.expense, item.currencyCode), items: financeAnalytics.verifiedTransactions.filter(tx => accountCurrencies.get(tx.accountId) === item.currencyCode && tx.date?.slice(0, 7) === data.months[5]?.key) })}>
                <div className="flex items-center justify-between gap-3"><strong className="text-sm">{item.currencyCode}</strong><span className="text-[10px]" style={muted}>{item.count} תנועות החודש · לחץ לפירוט</span></div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div><div className="mb-1 flex justify-between text-xs"><span style={muted}>הכנסות</span><strong>{currency(item.income, item.currencyCode)}</strong></div><div className="homeos-finance-track"><span className="income" style={{width:(item.income/maxAmount*100)+'%'}}/></div></div>
                  <div><div className="mb-1 flex justify-between text-xs"><span style={muted}>הוצאות</span><strong>{currency(item.expense, item.currencyCode)}</strong></div><div className="homeos-finance-track"><span className="expense" style={{width:(item.expense/maxAmount*100)+'%'}}/></div></div>
                </div>
              </button>;
            })}
          </div>
        </section>
      )}

            <section className="homeos-home-snapshot homeos-atlas-home" {...widgetAttributes('household-snapshot')}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><div className="homeos-section-kicker">ניהול הבית</div><h2 className="mt-1 text-lg font-bold">תמונת מצב הבית</h2><p className="mt-1 text-xs" style={muted}>נתוני ניהול הבית מסונכרנים עם לוח הבקרה</p></div>
          <button onClick={onOpenLedger} className="homeos-text-link">מעבר לפנקס העסקאות <ArrowLeft className="h-4 w-4" /></button>
        </div>
        <div className="homeos-home-snapshot-metrics">
          <button type="button" onClick={()=>onOpenHomeTab('planner')} title="פתיחת תכנון הארוחות"><span>ארוחות בשבעת הימים הקרובים</span><strong>{householdSnapshot.meals}</strong><small>פתיחת התפריט</small></button>
          <button type="button" onClick={()=>onOpenHomeTab('tasks')} title="פתיחת משימות הבית"><span>משימות פתוחות</span><strong>{householdSnapshot.openTasks}</strong><small>ניהול משימות</small></button>
          <button type="button" onClick={()=>onOpenHomeTab('shopping')} title="פתיחת רשימת הקניות"><span>פריטים ברשימת הקניות</span><strong>{householdSnapshot.openShopping}</strong><small>פתיחת רשימת הקניות</small></button>
        </div>
      </section>

            <section className="homeos-recent-grid grid gap-5 xl:grid-cols-[1.2fr_.8fr]" {...widgetAttributes('recent-activity')}>
        <div className={panel + ' p-5 sm:p-7'}>
          <div className="mb-4 flex items-center justify-between gap-3"><div><div className="homeos-section-kicker">פעילות אחרונה</div><h2 className="mt-1 text-lg font-bold">פעילות אחרונה</h2></div><button onClick={onOpenLedger} className="homeos-text-link">לכל העסקאות <ArrowLeft className="h-4 w-4" /></button></div>
          {data.recent.length ? <div className="divide-y" style={{ borderColor: activeTheme.borderSubtle }}>{data.recent.map(tx => <button type="button" key={tx.id} onClick={onOpenLedger} title="פתיחת פנקס העסקאות" className="flex w-full items-center justify-between gap-3 py-3.5 text-right transition hover:bg-black/5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-[#547D70] dark:hover:bg-white/5"><div className="flex min-w-0 items-center gap-3"><span className={'homeos-transaction-icon ' + (tx.type === 'INCOME' ? 'income' : tx.type === 'TRANSFER' ? '' : 'expense')}>{tx.type === 'INCOME' ? <ArrowDownRight className="h-4 w-4" /> : tx.type === 'TRANSFER' ? <ArrowLeftRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</span><div className="min-w-0"><div className="truncate text-sm font-semibold">{tx.payee || tx.category}</div><div className="mt-1 truncate text-[11px]" style={muted}>{tx.category} · {new Date(tx.date + 'T12:00:00').toLocaleDateString('he-IL')}{tx.verificationStatus === 'PENDING' ? ' · ממתינה לבדיקה' : ''}</div></div></div><strong className={'shrink-0 text-sm tabular-nums ' + (tx.type === 'INCOME' ? 'text-[#477866]' : '')}>{tx.type === 'INCOME' ? '+' : tx.type === 'TRANSFER' ? '↔ ' : '−'}{currency(tx.amountCents, accountCurrencies.get(tx.accountId) || 'ILS')}</strong></button>)}</div> : <div className="py-12 text-center text-sm" style={muted}>עדיין לא נרשמו עסקאות. הפעילות שתזין תופיע כאן.</div>}
        </div>
        <div className={panel + ' p-5 sm:p-7'}>
          <div className="homeos-section-kicker">סקירת חשבונות</div><h2 className="mt-1 text-lg font-bold">מבט על החשבונות</h2><p className="mt-1 text-xs" style={muted}>היתרות הפעילות במשק הבית</p>
          <div className="mt-5 space-y-3">{data.activeAccounts.slice(0, 4).map(acc => <button type="button" key={acc.id} onClick={onOpenAccounts} title="פתיחת ניהול חשבונות" className="flex w-full items-center justify-between gap-3 rounded-2xl border p-3 text-right transition hover:-translate-y-0.5 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#547D70]" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgSurface }}><div className="flex min-w-0 items-center gap-3"><span className="rounded-xl bg-[#547D70]/10 p-2.5 text-[#547D70]"><PiggyBank className="h-4 w-4" /></span><div className="min-w-0"><div className="truncate text-sm font-semibold">{acc.name}</div><div className="mt-0.5 text-[11px]" style={muted}>{acc.institution}</div></div></div><strong className="shrink-0 text-sm tabular-nums">{currency(acc.currentBalanceCents || 0, acc.currency)}</strong></button>)}</div>
          <button onClick={onOpenAccounts} className="homeos-wide-link mt-4">לכל החשבונות <ChevronLeft className="h-4 w-4" /></button>
        </div>
      </section>

      {chartDetail && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={chartDetail.title} onMouseDown={(event) => { if (event.target === event.currentTarget) setChartDetail(null); }}>
          <div className="max-h-[85vh] w-full max-w-2xl overflow-hidden rounded-3xl border bg-white shadow-2xl dark:bg-[#1E293B]" style={{ borderColor: activeTheme.borderSubtle }}>
            <div className="flex items-start justify-between gap-4 border-b p-5 sm:p-6" style={{ borderColor: activeTheme.borderSubtle }}>
              <div><div className="homeos-section-kicker">פירוט אינטראקטיבי</div><h2 className="mt-1 text-xl font-bold">{chartDetail.title}</h2><p className="mt-1 text-sm" style={muted}>{chartDetail.subtitle}</p></div>
              <button type="button" onClick={() => setChartDetail(null)} className="rounded-xl border px-3 py-2 text-sm" style={{ borderColor: activeTheme.borderSubtle }}>סגירה ✕</button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-5 sm:p-6">
              {chartDetail.note && <div className="mb-4 rounded-2xl border p-4 text-sm leading-6" style={{borderColor:activeTheme.borderSubtle,backgroundColor:activeTheme.bgSurface,color:activeTheme.textSecondary}}>{chartDetail.note}</div>}
              {chartDetail.items.length > 0 && <>
                <div className="mb-4 grid grid-cols-3 gap-2">
                  <div className="rounded-xl p-3" style={{backgroundColor:activeTheme.bgSurface}}><div className="text-[10px]" style={muted}>עסקאות</div><strong className="text-lg tabular-nums">{detailItems.length}</strong></div>
                  <div className="rounded-xl p-3" style={{backgroundColor:activeTheme.bgSurface}}><div className="text-[10px]" style={muted}>הכנסות</div><strong className="text-sm tabular-nums">{currency(detailIncome, detailCurrency)}</strong></div>
                  <div className="rounded-xl p-3" style={{backgroundColor:activeTheme.bgSurface}}><div className="text-[10px]" style={muted}>הוצאות</div><strong className="text-sm tabular-nums">{currency(detailExpense, detailCurrency)}</strong></div>
                </div>
                <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="סינון עסקאות בפירוט">
                  {([{id:'ALL',label:'הכול'},{id:'INCOME',label:'הכנסות'},{id:'EXPENSE',label:'הוצאות'}] as const).map(option=><button key={option.id} type="button" onClick={()=>setDetailFilter(option.id)} aria-pressed={detailFilter===option.id} className="rounded-full border px-3 py-1.5 text-xs font-semibold" style={{borderColor:detailFilter===option.id?activeTheme.accent:activeTheme.borderSubtle,backgroundColor:detailFilter===option.id?activeTheme.accent:'transparent',color:detailFilter===option.id?(activeTheme.isDark?'#111':'#fff'):activeTheme.textPrimary}}>{option.label}</button>)}
                </div>
              </>}
              {detailItems.length ? <div className="space-y-2">{detailItems.slice().sort((a,b) => b.date.localeCompare(a.date)).map(tx => (
                <div key={tx.id} className="flex items-center justify-between gap-3 rounded-xl border p-3" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgSurface }}>
                  <div className="min-w-0"><div className="truncate text-sm font-semibold">{tx.payee || tx.category}</div><div className="mt-1 text-xs" style={muted}>{tx.category} · {new Date(tx.date + 'T12:00:00').toLocaleDateString('he-IL')} · {accounts.find(account=>account.id===tx.accountId)?.name || 'חשבון'}</div></div>
                  <strong className={'shrink-0 text-sm tabular-nums ' + (tx.type === 'INCOME' ? 'text-[#477866]' : '')}>{tx.type === 'INCOME' ? '+' : tx.type === 'TRANSFER' ? '↔ ' : '−'}{currency(tx.amountCents, accountCurrencies.get(tx.accountId) || 'ILS')}</strong>
                </div>
              ))}</div> : <div className="py-8 text-center text-sm leading-6" style={muted}>{chartDetail.items.length ? 'אין עסקאות התואמות למסנן שבחרת.' : (chartDetail.note ? 'הפירוט כאן מסביר את חישוב התחזית; אין מדובר ברשימת תנועות עתידיות.' : 'אין עסקאות להצגה בתקופה הזו.')}</div>}
            </div>
            <div className="border-t p-4 text-left" style={{ borderColor: activeTheme.borderSubtle }}><button type="button" onClick={() => { setChartDetail(null); onOpenLedger(); }} className="homeos-primary-action">פתיחת פנקס העסקאות <ArrowLeft className="h-4 w-4" /></button></div>
          </div>
        </div>
      )}

      <section className="homeos-insight" {...widgetAttributes('financial-insight')}>
        <span className="homeos-insight-icon"><Lightbulb className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">תובנה פיננסית</h2><span className="rounded-full bg-[#547D70]/10 px-2 py-1 text-[10px] font-semibold text-[#547D70]">מבוסס נתונים בפועל</span></div><p className="mt-1 text-sm leading-6" style={muted}>{!hasActivity ? 'עדיין לא נרשמה פעילות החודש. לאחר הזנת עסקאות יופיע כאן ניתוח של התזרים וההוצאות.' : data.cashflow >= 0 ? 'התזרים החודשי כרגע חיובי ועומד על ' + currency(data.cashflow) + (data.topCategories[0] ? '. סעיף ההוצאה הגדול כרגע הוא ' + data.topCategories[0][0] + ' בסך ' + currency(data.topCategories[0][1]) + '. מומלץ לעקוב אחריו עד סוף החודש.' : '. מומלץ להמשיך לעקוב אחר ההוצאות לאורך החודש.') : 'ההוצאות גבוהות מההכנסות שנרשמו החודש ב-' + currency(Math.abs(data.cashflow)) + (data.topCategories[0] ? '. כדאי להתחיל בבדיקת סעיף ' + data.topCategories[0][0] + ' שהוא הגדול כרגע.' : '. כדאי לבדוק את העסקאות האחרונות.')}</p></div>
        <button onClick={onOpenLedger} className="homeos-text-link hidden sm:flex">ניתוח עסקאות <ArrowLeft className="h-4 w-4" /></button>
      </section>
    </div>
  );
};

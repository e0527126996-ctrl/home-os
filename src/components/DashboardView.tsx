import React, { useMemo } from 'react';
import {
  ArrowDownLeft, ArrowUpLeft, ArrowLeft, Wallet, Landmark, CreditCard,
  PiggyBank, Activity, TrendingUp, TrendingDown, Lightbulb, CalendarDays,
  Sparkles, ArrowUpRight, ArrowDownRight, ChartNoAxesCombined, ReceiptText,
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
  const data = useMemo(() => {
    const activeAccounts = accounts.filter(a => a.status === 'ACTIVE');
    const assets = activeAccounts.filter(a => !a.isLiability).reduce((s, a) => s + (a.currentBalanceCents || 0), 0);
    const liabilities = activeAccounts.filter(a => a.isLiability).reduce((s, a) => s + Math.abs(a.currentBalanceCents || 0), 0);
    const netWorth = assets - liabilities;
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 5 + index, 1);
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthTx = transactions.filter(tx => tx.date?.slice(0, 7) === key);
      return {
        key, label: monthLabel(date),
        income: monthTx.filter(tx => tx.type === 'INCOME').reduce((s, tx) => s + tx.amountCents, 0),
        expense: monthTx.filter(tx => tx.type === 'EXPENSE').reduce((s, tx) => s + tx.amountCents, 0),
      };
    });
    const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const current = months.find(m => m.key === currentKey) || { income: 0, expense: 0, label: '' };
    const previous = months[months.length - 2] || { income: 0, expense: 0, label: '' };
    const expenseChange = previous.expense > 0 ? ((current.expense - previous.expense) / previous.expense) * 100 : null;
    const max = Math.max(1, ...months.flatMap(m => [m.income, m.expense]));
    const categories = transactions
      .filter(tx => tx.type === 'EXPENSE' && tx.date?.slice(0, 7) === currentKey)
      .reduce<Record<string, number>>((acc, tx) => {
        acc[tx.category || 'ללא קטגוריה'] = (acc[tx.category || 'ללא קטגוריה'] || 0) + tx.amountCents;
        return acc;
      }, {});
    const topCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 6);
    return { assets, liabilities, netWorth, months, max, current, previous, expenseChange, topCategories, recent, activeAccounts };
  }, [accounts, transactions]);

  const currency = (cents: number) => money(cents / 100);
  const muted = { color: activeTheme.textSecondary };
  const panel = 'rounded-[22px] border shadow-[0_12px_36px_rgba(20,30,25,.045)]';
  const categoryTotal = data.topCategories.reduce((sum, item) => sum + item[1], 0);
  const categoryColors = ['#557A63', '#C79A58', '#6B8196', '#A77B70', '#8D8B73'];
  const monthName = new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(new Date());

  return (
    <div className="space-y-6 pb-8" dir="rtl">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-[11px] font-bold tracking-[.16em]" style={{ color: activeTheme.accent }}>
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: activeTheme.accent }} />
            HOME OS <span className="opacity-40">/</span> מרכז הבקרה
          </div>
          <h1 className="text-3xl font-bold tracking-tight sm:text-[2.15rem]" style={{ color: activeTheme.textPrimary }}>שלום, {householdName || 'הבית שלנו'}</h1>
          <p className="mt-2 text-sm" style={muted}>התמונה הפיננסית המלאה של משק הבית, במקום אחד.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-xl border px-3 py-2 text-xs font-medium" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgCard, color: activeTheme.textSecondary }}>{monthName}</span>
          <button onClick={onOpenLedger} className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:-translate-y-0.5" style={{ backgroundColor: activeTheme.accent }}>
            <ReceiptText className="h-4 w-4" /> פנקס העסקאות
          </button>
          <button onClick={onOpenAccounts} className="inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition hover:bg-black/5" style={{ borderColor: activeTheme.borderSubtle, color: activeTheme.textPrimary }}>
            <Landmark className="h-4 w-4" /> חשבונות
          </button>
        </div>
      </header>

      <section className="relative isolate overflow-hidden rounded-[28px] p-6 text-white shadow-[0_22px_60px_rgba(20,38,31,.18)] sm:p-8" style={{ background: 'linear-gradient(120deg,#142923 0%,#23483B 56%,#42634F 100%)' }}>
        <div className="pointer-events-none absolute -left-16 -top-28 -z-10 h-80 w-80 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -left-2 -top-16 -z-10 h-56 w-56 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute bottom-[-100px] right-[35%] -z-10 h-64 w-64 rounded-full bg-white/[.035] blur-2xl" />
        <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-emerald-100/75"><Wallet className="h-4 w-4" /> השווי הנקי של משק הבית</div>
            <div className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-4xl font-bold tracking-tight tabular-nums sm:text-5xl">{currency(data.netWorth)}</span>
              <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] text-emerald-50/80">נכסים פחות התחייבויות</span>
            </div>
            <p className="mt-3 max-w-lg text-sm leading-6 text-emerald-50/70">מדד מרכזי למצב הכלכלי הכולל. הנתון מחושב מהיתרות בחשבונות הפעילים.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <div className="rounded-2xl border border-white/10 bg-white/[.075] p-3 sm:p-4">
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-100/70"><ArrowUpLeft className="h-3.5 w-3.5" /> נכסים</div>
              <div className="mt-2 text-lg font-bold tabular-nums sm:text-xl">{currency(data.assets)}</div>
              <div className="mt-1 text-[10px] text-emerald-100/55">{data.activeAccounts.filter(a => !a.isLiability).length} חשבונות</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[.075] p-3 sm:p-4">
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-100/70"><ArrowDownLeft className="h-3.5 w-3.5" /> התחייבויות</div>
              <div className="mt-2 text-lg font-bold tabular-nums sm:text-xl">{currency(data.liabilities)}</div>
              <div className="mt-1 text-[10px] text-emerald-100/55">{data.activeAccounts.filter(a => a.isLiability).length} התחייבויות</div>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[.075] p-3 sm:p-4">
              <div className="flex items-center gap-1.5 text-[11px] text-emerald-100/70"><Activity className="h-3.5 w-3.5" /> תזרים חודשי</div>
              <div className="mt-2 text-lg font-bold tabular-nums sm:text-xl">{currency(data.current.income - data.current.expense)}</div>
              <div className="mt-1 text-[10px] text-emerald-100/55">הכנסות פחות הוצאות</div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <div className={`${panel} p-5`} style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}>
          <div className="flex items-center justify-between"><span className="text-sm font-medium" style={muted}>הכנסות החודש</span><span className="rounded-xl bg-emerald-500/10 p-2.5 text-emerald-700"><TrendingUp className="h-5 w-5" /></span></div>
          <div className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-emerald-700">{currency(data.current.income)}</div>
          <div className="mt-2 text-xs" style={muted}>על בסיס עסקאות הכנסה שנרשמו</div>
        </div>
        <div className={`${panel} p-5`} style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}>
          <div className="flex items-center justify-between"><span className="text-sm font-medium" style={muted}>הוצאות החודש</span><span className="rounded-xl bg-amber-500/10 p-2.5 text-amber-700"><TrendingDown className="h-5 w-5" /></span></div>
          <div className="mt-3 text-2xl font-bold tracking-tight tabular-nums" style={{ color: activeTheme.textPrimary }}>{currency(data.current.expense)}</div>
          <div className="mt-2 text-xs" style={muted}>על בסיס עסקאות הוצאה שנרשמו</div>
        </div>
        <div className={`${panel} p-5`} style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}>
          <div className="flex items-center justify-between"><span className="text-sm font-medium" style={muted}>שינוי בהוצאות</span><span className="rounded-xl p-2.5" style={{ backgroundColor: activeTheme.accentMuted, color: activeTheme.accent }}><CalendarDays className="h-5 w-5" /></span></div>
          <div className="mt-3 text-2xl font-bold tracking-tight tabular-nums" style={{ color: data.expenseChange === null ? activeTheme.textPrimary : data.expenseChange > 0 ? '#B45345' : '#25805A' }}>{data.expenseChange === null ? '—' : `${data.expenseChange > 0 ? '+' : ''}${data.expenseChange.toFixed(1)}%`}</div>
          <div className="mt-2 text-xs" style={muted}>{data.expenseChange === null ? 'אין עדיין בסיס להשוואה' : data.expenseChange > 0 ? 'עלייה לעומת החודש הקודם' : data.expenseChange < 0 ? 'ירידה לעומת החודש הקודם' : 'ללא שינוי לעומת החודש הקודם'}</div>
        </div>
      </section>

      <section className={`${panel} flex items-start gap-4 p-5 sm:p-6`} style={{ backgroundColor: activeTheme.bgSurface, borderColor: activeTheme.borderSubtle }}>
        <span className="shrink-0 rounded-2xl p-3" style={{ backgroundColor: activeTheme.accentMuted, color: activeTheme.accent }}><Lightbulb className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h2 className="font-bold">תובנה פיננסית</h2><span className="rounded-full px-2 py-0.5 text-[10px] font-semibold" style={{ backgroundColor: activeTheme.accentMuted, color: activeTheme.accent }}>מבוסס נתונים</span></div>
          <p className="mt-1 text-sm leading-6" style={muted}>
            {data.current.income === 0 && data.current.expense === 0
              ? 'עדיין לא נרשמה פעילות פיננסית החודש. לאחר הזנת עסקאות יוצגו כאן תובנות המבוססות על הנתונים בפועל.'
              : data.current.income - data.current.expense >= 0
                ? `התזרים החודשי חיובי ועומד על ${currency(data.current.income - data.current.expense)}. כדאי להמשיך לעקוב אחר ההוצאות ולשמור על המגמה.`
                : `ההוצאות גבוהות מההכנסות ב-${currency(data.current.expense - data.current.income)}. מומלץ לבדוק את הקטגוריות והעסקאות האחרונות.`
            }
          </p>
        </div>
        <button onClick={onOpenLedger} className="hidden shrink-0 items-center gap-1 text-xs font-bold sm:flex" style={{ color: activeTheme.accent }}>לניתוח העסקאות <ArrowLeft className="h-3.5 w-3.5" /></button>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <div className={`${panel} p-5 sm:p-6`} style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div><div className="flex items-center gap-2"><ChartNoAxesCombined className="h-4 w-4" style={{ color: activeTheme.accent }} /><h2 className="text-base font-bold">תנועת הכסף</h2></div><p className="mt-1 text-xs" style={muted}>הכנסות והוצאות · ששת החודשים האחרונים</p></div>
            <div className="flex gap-3 text-[11px]" style={muted}><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-emerald-600" /> הכנסות</span><span className="flex items-center gap-1.5"><i className="h-2.5 w-2.5 rounded-full bg-amber-500" /> הוצאות</span></div>
          </div>
          <div className="relative">
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between pb-8 pt-1">{[0,1,2,3].map(i => <div key={i} className="border-t border-dashed" style={{ borderColor: activeTheme.borderSubtle }} />)}</div>
            <div className="relative grid h-52 grid-cols-6 gap-2 sm:gap-4">
              {data.months.map((month, index) => (
                <div key={month.key} className="flex min-w-0 flex-col items-center justify-end gap-2">
                  <div className="flex h-[85%] w-full items-end justify-center gap-1 sm:gap-2">
                    <div title={`הכנסות: ${currency(month.income)}`} className="w-[34%] max-w-8 rounded-t-lg bg-emerald-600 transition-all duration-500" style={{ height: `${Math.max(month.income ? 4 : 1, month.income / data.max * 100)}%`, opacity: index === 5 ? 1 : .78 }} />
                    <div title={`הוצאות: ${currency(month.expense)}`} className="w-[34%] max-w-8 rounded-t-lg bg-amber-500 transition-all duration-500" style={{ height: `${Math.max(month.expense ? 4 : 1, month.expense / data.max * 100)}%`, opacity: index === 5 ? 1 : .78 }} />
                  </div>
                  <span className="text-[10px] font-medium sm:text-xs" style={muted}>{month.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3 border-t pt-4" style={{ borderColor: activeTheme.borderSubtle }}>
            <div><div className="text-[11px]" style={muted}>מאזן החודש</div><div className="mt-1 text-lg font-bold tabular-nums" style={{ color: data.current.income >= data.current.expense ? '#25805A' : '#B45345' }}>{currency(data.current.income - data.current.expense)}</div></div>
            <div className="text-left"><div className="text-[11px]" style={muted}>ממוצע הוצאות 6 חודשים</div><div className="mt-1 text-lg font-bold tabular-nums" style={{ color: activeTheme.textPrimary }}>{currency(data.months.reduce((s,m)=>s+m.expense,0) / 6)}</div></div>
          </div>
        </div>

        <div className={`${panel} p-5 sm:p-6`} style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}>
          <div className="mb-5"><div className="flex items-center gap-2"><Activity className="h-4 w-4" style={{ color: activeTheme.accent }} /><h2 className="text-base font-bold">לאן הכסף הולך?</h2></div><p className="mt-1 text-xs" style={muted}>התפלגות הוצאות החודש</p></div>
          {data.topCategories.length ? (
            <>
              <div className="mx-auto mb-5 flex h-36 w-36 items-center justify-center rounded-full" style={{ background: `conic-gradient(${data.topCategories.map(([name,value],i)=>`${categoryColors[i]} ${data.topCategories.slice(0,i).reduce((s,x)=>s+x[1],0)/categoryTotal*100}% ${(data.topCategories.slice(0,i).reduce((s,x)=>s+x[1],0)+value)/categoryTotal*100}%`).join(', ')})` }}>
                <div className="flex h-24 w-24 flex-col items-center justify-center rounded-full text-center" style={{ backgroundColor: activeTheme.bgCard }}><span className="text-[10px]" style={muted}>סה״כ הוצאות</span><strong className="mt-1 text-sm tabular-nums">{currency(categoryTotal)}</strong></div>
              </div>
              <div className="space-y-3">{data.topCategories.map(([name,value],i)=>(
                <div key={name} className="flex items-center justify-between gap-3 text-xs"><span className="flex min-w-0 items-center gap-2"><i className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{backgroundColor:categoryColors[i]}}/><span className="truncate">{name}</span></span><strong className="shrink-0 tabular-nums">{currency(value)}</strong></div>
              ))}</div>
            </>
          ) : <div className="flex min-h-48 flex-col items-center justify-center text-center"><Sparkles className="mb-3 h-7 w-7" style={muted} /><p className="text-sm font-semibold">אין עדיין נתוני הוצאות</p><p className="mt-1 max-w-[220px] text-xs leading-5" style={muted}>לאחר רישום עסקאות יוצג כאן פירוט חזותי לפי קטגוריות.</p></div>}
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <div className={`${panel} p-5 sm:p-6`} style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}>
          <div className="mb-3 flex items-center justify-between gap-3"><div><h2 className="text-base font-bold">פעילות אחרונה</h2><p className="mt-1 text-xs" style={muted}>התנועות האחרונות שנרשמו במערכת</p></div><button onClick={onOpenLedger} className="flex items-center gap-1 text-xs font-bold" style={{color:activeTheme.accent}}>כל העסקאות <ArrowLeft className="h-3.5 w-3.5"/></button></div>
          {data.recent.length ? <div className="divide-y" style={{borderColor:activeTheme.borderSubtle}}>{data.recent.map(tx=>(
            <div key={tx.id} className="flex items-center justify-between gap-3 py-3">
              <div className="flex min-w-0 items-center gap-3"><span className="rounded-xl p-2.5" style={{backgroundColor:tx.type==='INCOME'?'rgba(22,163,74,.10)':tx.type==='EXPENSE'?'rgba(217,119,6,.10)':'rgba(59,130,246,.10)',color:tx.type==='INCOME'?'#15803D':tx.type==='EXPENSE'?'#B45309':'#2563EB'}}>{tx.type==='INCOME'?<ArrowDownRight className="h-4 w-4"/>:tx.type==='EXPENSE'?<ArrowUpRight className="h-4 w-4"/>:<Activity className="h-4 w-4"/>}</span><div className="min-w-0"><div className="truncate text-sm font-semibold">{tx.payee || tx.category}</div><div className="mt-1 truncate text-[11px]" style={muted}>{tx.category} · {new Date(tx.date+'T12:00:00').toLocaleDateString('he-IL')}</div></div></div>
              <strong className="shrink-0 text-sm tabular-nums" style={{color:tx.type==='INCOME'?'#15803D':activeTheme.textPrimary}}>{tx.type==='INCOME'?'+':tx.type==='EXPENSE'?'−':'↔'}{currency(tx.amountCents)}</strong>
            </div>
          ))}</div> : <div className="py-12 text-center"><ReceiptText className="mx-auto mb-2 h-7 w-7" style={muted}/><p className="text-sm font-semibold">עדיין אין פעילות</p><p className="mt-1 text-xs" style={muted}>העסקאות שתזין יופיעו כאן.</p><button onClick={onOpenLedger} className="mt-4 rounded-xl px-4 py-2 text-xs font-bold text-white" style={{backgroundColor:activeTheme.accent}}>פתיחת פנקס העסקאות</button></div>}
        </div>

        <div className={`${panel} p-5 sm:p-6`} style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}>
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-base font-bold">חשבונות ונכסים</h2><p className="mt-1 text-xs" style={muted}>יתרות החשבונות הפעילים</p></div><span className="rounded-xl p-2.5" style={{backgroundColor:activeTheme.accentMuted,color:activeTheme.accent}}><Landmark className="h-4 w-4"/></span></div>
          {data.activeAccounts.length ? <div className="space-y-2.5">{data.activeAccounts.slice(0,5).map(account=>(
            <div key={account.id} className="flex items-center justify-between gap-3 rounded-2xl p-3" style={{backgroundColor:activeTheme.bgCanvas}}>
              <div className="flex min-w-0 items-center gap-3"><span className="rounded-xl p-2" style={{backgroundColor:activeTheme.accentMuted,color:activeTheme.accent}}>{account.type==='CREDIT_CARD'?<CreditCard className="h-4 w-4"/>:account.type==='SAVINGS'?<PiggyBank className="h-4 w-4"/>:<Landmark className="h-4 w-4"/>}</span><div className="min-w-0"><div className="truncate text-sm font-semibold">{account.name}</div><div className="truncate text-[11px]" style={muted}>{account.institution || 'חשבון אישי'}</div></div></div>
              <strong className="shrink-0 text-sm tabular-nums">{currency(account.currentBalanceCents)}</strong>
            </div>
          ))}</div> : <div className="py-10 text-center text-sm" style={muted}>עדיין לא הוגדרו חשבונות</div>}
          <button onClick={onOpenAccounts} className="mt-4 w-full rounded-xl border py-3 text-xs font-bold transition hover:bg-black/5" style={{borderColor:activeTheme.borderSubtle,color:activeTheme.textPrimary}}>ניהול כל החשבונות</button>
        </div>
      </section>
    </div>
  );
};

import React, { useMemo } from 'react';
import { ArrowDownLeft, ArrowUpLeft, Wallet, Landmark, CreditCard, PiggyBank, ArrowLeft, Sparkles, Activity } from 'lucide-react';
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
    const max = Math.max(1, ...months.flatMap(m => [m.income, m.expense]));
    const categories = transactions
      .filter(tx => tx.type === 'EXPENSE' && tx.date?.slice(0, 7) === currentKey)
      .reduce<Record<string, number>>((acc, tx) => {
        acc[tx.category || 'ללא קטגוריה'] = (acc[tx.category || 'ללא קטגוריה'] || 0) + tx.amountCents;
        return acc;
      }, {});
    const topCategories = Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const recent = [...transactions].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
    return { assets, liabilities, netWorth, months, max, current, topCategories, recent, activeAccounts };
  }, [accounts, transactions]);

  const card = 'rounded-2xl border p-5 shadow-sm';
  const muted = { color: activeTheme.textSecondary };
  const currency = (cents: number) => money(cents / 100);

  return (
    <div className="space-y-6" dir="rtl">
      <section className="relative overflow-hidden rounded-3xl p-7 md:p-9 text-white shadow-lg" style={{ background: 'linear-gradient(115deg, #172A26 0%, #29463D 58%, #526D5C 100%)' }}>
        <div className="absolute -left-12 -top-20 h-64 w-64 rounded-full border border-white/10" />
        <div className="absolute -left-2 -top-10 h-44 w-44 rounded-full border border-white/10" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-xs tracking-[.18em] text-emerald-100/75"><Activity className="h-4 w-4" /> HOME OS · HOUSEHOLD FINANCE</div>
            <div className="text-sm text-emerald-50/75">תמונת המצב של</div>
            <h1 className="font-serif text-3xl md:text-4xl font-semibold tracking-tight">{householdName || 'הבית שלנו'}</h1>
            <p className="max-w-xl text-sm leading-7 text-emerald-50/75">כל התמונה הפיננסית במקום אחד — יתרות, תזרים והפעילות האחרונה.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={onOpenLedger} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-emerald-950 transition hover:bg-emerald-50">לספר העסקאות <ArrowLeft className="mr-2 inline h-4 w-4" /></button>
            <button onClick={onOpenAccounts} className="rounded-xl border border-white/30 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10">לחשבונות</button>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className={card} style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}>
          <div className="flex items-center justify-between text-sm" style={muted}><span>שווי נקי</span><Wallet className="h-4 w-4" /></div>
          <div className="mt-3 text-2xl font-bold tracking-tight tabular-nums">{currency(data.netWorth)}</div>
          <div className="mt-2 text-xs" style={muted}>נכסים פחות התחייבויות</div>
        </div>
        <div className={card} style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}>
          <div className="flex items-center justify-between text-sm" style={muted}><span>נכסים</span><ArrowUpLeft className="h-4 w-4 text-emerald-600" /></div>
          <div className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-emerald-700">{currency(data.assets)}</div>
          <div className="mt-2 text-xs" style={muted}>{data.activeAccounts.filter(a => !a.isLiability).length} חשבונות ונכסים פעילים</div>
        </div>
        <div className={card} style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}>
          <div className="flex items-center justify-between text-sm" style={muted}><span>התחייבויות</span><ArrowDownLeft className="h-4 w-4 text-rose-600" /></div>
          <div className="mt-3 text-2xl font-bold tracking-tight tabular-nums text-rose-700">{currency(data.liabilities)}</div>
          <div className="mt-2 text-xs" style={muted}>{data.activeAccounts.filter(a => a.isLiability).length} התחייבויות פעילות</div>
        </div>
        <div className={card} style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}>
          <div className="flex items-center justify-between text-sm" style={muted}><span>תזרים החודש</span><Activity className="h-4 w-4" /></div>
          <div className="mt-3 text-2xl font-bold tracking-tight tabular-nums" style={{ color: data.current.income - data.current.expense >= 0 ? '#15803d' : '#be123c' }}>{currency(data.current.income - data.current.expense)}</div>
          <div className="mt-2 text-xs" style={muted}>הכנסות פחות הוצאות החודש</div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.65fr_1fr]">
        <div className={card} style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}>
          <div className="mb-6 flex items-center justify-between"><div><h2 className="text-lg font-semibold">תזרים חודשי</h2><p className="mt-1 text-xs" style={muted}>ששת החודשים האחרונים · לפי העסקאות שנרשמו</p></div><span className="rounded-full px-3 py-1 text-xs" style={{ backgroundColor: activeTheme.accentMuted, color: activeTheme.accent }}>₪</span></div>
          <div className="flex h-52 items-end justify-between gap-3 border-b pb-2" style={{ borderColor: activeTheme.borderSubtle }}>
            {data.months.map(month => (
              <div key={month.key} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
                <div className="flex h-[82%] w-full items-end justify-center gap-1.5">
                  <div title={`הכנסות: ${currency(month.income)}`} className="w-3/12 max-w-7 rounded-t-md bg-emerald-600/85 transition-all" style={{ height: `${Math.max(2, month.income / data.max * 100)}%` }} />
                  <div title={`הוצאות: ${currency(month.expense)}`} className="w-3/12 max-w-7 rounded-t-md bg-amber-600/80 transition-all" style={{ height: `${Math.max(2, month.expense / data.max * 100)}%` }} />
                </div>
                <span className="text-[11px]" style={muted}>{month.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 flex gap-5 text-xs" style={muted}><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-emerald-600" /> הכנסות</span><span className="flex items-center gap-2"><i className="h-2.5 w-2.5 rounded-sm bg-amber-600" /> הוצאות</span></div>
        </div>

        <div className={card} style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}>
          <div className="mb-5"><h2 className="text-lg font-semibold">הוצאות לפי קטגוריה</h2><p className="mt-1 text-xs" style={muted}>החודש הנוכחי</p></div>
          {data.topCategories.length ? <div className="space-y-5">{data.topCategories.map(([name, value]) => {
            const total = data.topCategories.reduce((sum, item) => sum + item[1], 0);
            return <div key={name}><div className="mb-2 flex justify-between gap-3 text-sm"><span className="truncate">{name}</span><strong className="tabular-nums">{currency(value)}</strong></div><div className="h-2 overflow-hidden rounded-full" style={{ backgroundColor: activeTheme.borderSubtle }}><div className="h-full rounded-full" style={{ width: `${value / total * 100}%`, backgroundColor: activeTheme.accent }} /></div></div>;
          })}</div> : <div className="flex min-h-36 flex-col items-center justify-center text-center"><Sparkles className="mb-2 h-6 w-6" style={muted} /><p className="text-sm font-medium">עדיין אין הוצאות החודש</p><p className="mt-1 text-xs" style={muted}>כשתירשמנה עסקאות, תופיע כאן חלוקה לפי קטגוריות</p></div>}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-5 xl:grid-cols-[1.35fr_1fr]">
        <div className={card} style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}>
          <div className="mb-4 flex items-center justify-between"><div><h2 className="text-lg font-semibold">פעילות אחרונה</h2><p className="mt-1 text-xs" style={muted}>חמש התנועות האחרונות</p></div><button onClick={onOpenLedger} className="text-xs font-semibold" style={{ color: activeTheme.accent }}>לכל העסקאות ←</button></div>
          {data.recent.length ? <div className="divide-y" style={{ borderColor: activeTheme.borderSubtle }}>{data.recent.map(tx => <div key={tx.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><div className="truncate text-sm font-medium">{tx.payee || tx.category}</div><div className="mt-1 text-xs" style={muted}>{tx.category} · {new Date(tx.date + 'T12:00:00').toLocaleDateString('he-IL')}</div></div><strong className={`shrink-0 text-sm tabular-nums ${tx.type === 'INCOME' ? 'text-emerald-700' : tx.type === 'EXPENSE' ? 'text-stone-700' : 'text-blue-700'}`}>{tx.type === 'INCOME' ? '+' : tx.type === 'EXPENSE' ? '−' : '↔'}{currency(tx.amountCents)}</strong></div>)}</div> : <div className="py-10 text-center text-sm" style={muted}>עדיין לא נרשמו עסקאות</div>}
        </div>
        <div className={card} style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}>
          <div className="mb-4"><h2 className="text-lg font-semibold">חשבונות מרכזיים</h2><p className="mt-1 text-xs" style={muted}>יתרות עדכניות מכל החשבונות הפעילים</p></div>
          {data.activeAccounts.length ? <div className="space-y-3">{data.activeAccounts.slice(0, 5).map(account => <div key={account.id} className="flex items-center justify-between gap-3 rounded-xl p-3" style={{ backgroundColor: activeTheme.bgCanvas }}><div className="flex min-w-0 items-center gap-3"><span className="rounded-lg p-2" style={{ backgroundColor: activeTheme.accentMuted, color: activeTheme.accent }}>{account.type === 'CREDIT_CARD' ? <CreditCard className="h-4 w-4" /> : account.type === 'SAVINGS' ? <PiggyBank className="h-4 w-4" /> : <Landmark className="h-4 w-4" />}</span><div className="min-w-0"><div className="truncate text-sm font-medium">{account.name}</div><div className="text-xs" style={muted}>{account.institution}</div></div></div><strong className="shrink-0 text-sm tabular-nums">{currency(account.currentBalanceCents)}</strong></div>)}</div> : <div className="py-10 text-center text-sm" style={muted}>עדיין לא הוגדרו חשבונות</div>}
          <button onClick={onOpenAccounts} className="mt-4 w-full rounded-xl border py-2.5 text-xs font-semibold transition hover:opacity-75" style={{ borderColor: activeTheme.borderSubtle, color: activeTheme.textPrimary }}>ניהול כל החשבונות</button>
        </div>
      </section>
    </div>
  );
};

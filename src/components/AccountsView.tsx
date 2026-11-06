import React, { useState } from 'react';
import {
  Landmark,
  CreditCard,
  PiggyBank,
  FileText,
  Plus,
  Archive,
  RefreshCw,
  Trash2,
  Edit2,
  TrendingUp,
  TrendingDown,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { AccountType, FinancialAccount, User } from '../types.ts';
import { ThemeConfig } from '../lib/themes.ts';
import { AccountModal } from './AccountModal.tsx';

interface AccountsViewProps {
  accounts: FinancialAccount[];
  activeTheme: ThemeConfig;
  canEdit: boolean;
  currentUser: User | null;
  onSaveAccount: (data: any, accountId?: string) => Promise<void>;
  onArchiveAccount: (accountId: string) => Promise<void>;
  onDeleteAccount: (accountId: string) => Promise<void>;
  onSeedDemoAccounts: () => Promise<void>;
  onOpenLedgerForAccount?: (accountId: string) => void;
}

export const AccountsView: React.FC<AccountsViewProps> = ({
  accounts,
  activeTheme,
  canEdit,
  currentUser,
  onSaveAccount,
  onArchiveAccount,
  onDeleteAccount,
  onSeedDemoAccounts,
  onOpenLedgerForAccount,
}) => {
  const [filterType, setFilterType] = useState<AccountType | 'ALL' | 'ARCHIVED'>('ALL');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<FinancialAccount | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Compute precise financial totals
  let totalAssets = 0;
  let totalLiabilities = 0;
  let checkingCount = 0;
  let creditCount = 0;
  let savingsCount = 0;
  let loansCount = 0;

  for (const acc of accounts) {
    if (acc.status === 'ARCHIVED' || acc.status === 'CLOSED') continue;
    const bal = Math.round(Number(acc.currentBalance || 0) * 100) / 100;

    if (acc.type === 'CHECKING') {
      checkingCount++;
      if (bal >= 0) {
        totalAssets = Math.round((totalAssets + bal) * 100) / 100;
      } else {
        totalLiabilities = Math.round((totalLiabilities + Math.abs(bal)) * 100) / 100;
      }
    } else if (acc.type === 'SAVINGS') {
      savingsCount++;
      if (bal >= 0) {
        totalAssets = Math.round((totalAssets + bal) * 100) / 100;
      }
    } else if (acc.type === 'CREDIT_CARD') {
      creditCount++;
      totalLiabilities = Math.round((totalLiabilities + Math.abs(bal)) * 100) / 100;
    } else if (acc.type === 'LOAN_MORTGAGE') {
      loansCount++;
      totalLiabilities = Math.round((totalLiabilities + Math.abs(bal)) * 100) / 100;
    }
  }

  const netWorth = Math.round((totalAssets - totalLiabilities) * 100) / 100;

  // Filter accounts
  const displayedAccounts = accounts.filter((acc) => {
    if (filterType === 'ARCHIVED') return acc.status === 'ARCHIVED';
    if (acc.status === 'ARCHIVED') return false;
    if (filterType === 'ALL') return true;
    return acc.type === filterType;
  });

  const formatCurrency = (val: number, currency = 'ILS') => {
    const symbol = currency === 'ILS' ? '₪' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£';
    return `${symbol}${val.toLocaleString('he-IL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getAccountTypeLabel = (t: AccountType) => {
    switch (t) {
      case 'CHECKING':
        return 'חשבון עו״ש';
      case 'CREDIT_CARD':
        return 'כרטיס אשראי';
      case 'SAVINGS':
        return 'חיסכון והשקעה';
      case 'LOAN_MORTGAGE':
        return 'הלוואה / משכנתא';
    }
  };

  const getAccountTypeIcon = (t: AccountType) => {
    switch (t) {
      case 'CHECKING':
        return <Landmark className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />;
      case 'CREDIT_CARD':
        return <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />;
      case 'SAVINGS':
        return <PiggyBank className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case 'LOAN_MORTGAGE':
        return <FileText className="w-4 h-4 text-rose-600 dark:text-rose-400" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Editorial Financial Header Banner */}
      <div
        className="p-6 rounded-xl border relative overflow-hidden"
        style={{
          backgroundColor: activeTheme.bgSurface,
          borderColor: activeTheme.borderSubtle,
        }}
      >
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-[11px] font-mono uppercase tracking-wider" style={{ color: activeTheme.accent }}>
              תמונת מצב פיננסית ראשית · PHASE 2 SUB-PHASE A
            </div>
            <h1 className="font-serif text-2xl font-bold">ניהול חשבונות ונכסים</h1>
            <p className="text-xs max-w-2xl leading-relaxed" style={{ color: activeTheme.textSecondary }}>
              ריכוז כלל חשבונות העו״ש, כרטיסי האשראי, קופות החיסכון וההתחייבויות של משק הבית. נתונים אלו מהווים את
              בסיס האמת הפיננסי (Single Source of Truth) שממנו יחושב ספר העסקאות והתקציב.
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {canEdit && (
              <button
                onClick={() => {
                  setEditingAccount(null);
                  setModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded text-white shadow-xs transition-all hover:opacity-90"
                style={{ backgroundColor: activeTheme.accent }}
              >
                <Plus className="w-4 h-4" />
                <span>הוסף חשבון חדש</span>
              </button>
            )}

            {accounts.length === 0 && canEdit && (
              <button
                onClick={onSeedDemoAccounts}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded border hover:opacity-90 transition-opacity"
                style={{
                  backgroundColor: activeTheme.bgCard,
                  borderColor: activeTheme.borderSubtle,
                  color: activeTheme.textPrimary,
                }}
                title="טען 4 חשבונות משפחתיים ראשוניים (עו״ש, כרטיס, חיסכון ומשכנתא)"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                <span>טען 4 חשבונות לדוגמה</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Top Net Worth & Asset / Liability Barometer */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Net Worth Card */}
        <div
          className="p-5 rounded-lg border space-y-1 relative"
          style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}
        >
          <div className="text-[11px] uppercase tracking-wider font-mono opacity-60">שווי נטו כולל (Net Worth)</div>
          <div
            className={`font-serif text-3xl font-bold tabular-nums ${
              netWorth >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'
            }`}
          >
            {formatCurrency(netWorth)}
          </div>
          <div className="text-xs opacity-75 flex items-center gap-1.5 pt-1">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeTheme.accent }} />
            <span>סך נכסים בניכוי התחייבויות והלוואות</span>
          </div>
        </div>

        {/* Total Assets */}
        <div
          className="p-5 rounded-lg border space-y-1"
          style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}
        >
          <div className="text-[11px] uppercase tracking-wider font-mono opacity-60 flex items-center justify-between">
            <span>סך נכסים נזילים והשקעות</span>
            <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
          </div>
          <div className="font-serif text-3xl font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
            {formatCurrency(totalAssets)}
          </div>
          <div className="text-xs opacity-75">
            {checkingCount} חשבונות עו״ש + {savingsCount} קופות חיסכון
          </div>
        </div>

        {/* Total Liabilities */}
        <div
          className="p-5 rounded-lg border space-y-1"
          style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}
        >
          <div className="text-[11px] uppercase tracking-wider font-mono opacity-60 flex items-center justify-between">
            <span>סך התחייבויות וחובות</span>
            <TrendingDown className="w-3.5 h-3.5 text-rose-600" />
          </div>
          <div className="font-serif text-3xl font-bold tabular-nums text-rose-600 dark:text-rose-400">
            {formatCurrency(totalLiabilities)}
          </div>
          <div className="text-xs opacity-75">
            {creditCount} כרטיסי אשראי + {loansCount} הלוואות ומשכנתאות
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div
        className="flex items-center gap-1 p-1 rounded-lg border overflow-x-auto"
        style={{ backgroundColor: activeTheme.bgSurface, borderColor: activeTheme.borderSubtle }}
      >
        <button
          onClick={() => setFilterType('ALL')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
            filterType === 'ALL' ? 'text-white' : 'hover:bg-black/5 dark:hover:bg-white/5'
          }`}
          style={{
            backgroundColor: filterType === 'ALL' ? activeTheme.accent : 'transparent',
          }}
        >
          כל החשבונות ({accounts.filter((a) => a.status !== 'ARCHIVED').length})
        </button>

        <button
          onClick={() => setFilterType('CHECKING')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
            filterType === 'CHECKING' ? 'text-white' : 'hover:bg-black/5 dark:hover:bg-white/5'
          }`}
          style={{
            backgroundColor: filterType === 'CHECKING' ? activeTheme.accent : 'transparent',
          }}
        >
          עו״ש ({checkingCount})
        </button>

        <button
          onClick={() => setFilterType('CREDIT_CARD')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
            filterType === 'CREDIT_CARD' ? 'text-white' : 'hover:bg-black/5 dark:hover:bg-white/5'
          }`}
          style={{
            backgroundColor: filterType === 'CREDIT_CARD' ? activeTheme.accent : 'transparent',
          }}
        >
          כרטיסי אשראי ({creditCount})
        </button>

        <button
          onClick={() => setFilterType('SAVINGS')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
            filterType === 'SAVINGS' ? 'text-white' : 'hover:bg-black/5 dark:hover:bg-white/5'
          }`}
          style={{
            backgroundColor: filterType === 'SAVINGS' ? activeTheme.accent : 'transparent',
          }}
        >
          חסכונות והשקעות ({savingsCount})
        </button>

        <button
          onClick={() => setFilterType('LOAN_MORTGAGE')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
            filterType === 'LOAN_MORTGAGE' ? 'text-white' : 'hover:bg-black/5 dark:hover:bg-white/5'
          }`}
          style={{
            backgroundColor: filterType === 'LOAN_MORTGAGE' ? activeTheme.accent : 'transparent',
          }}
        >
          הלוואות ומשכנתאות ({loansCount})
        </button>

        <button
          onClick={() => setFilterType('ARCHIVED')}
          className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ml-auto ${
            filterType === 'ARCHIVED' ? 'text-white' : 'hover:bg-black/5 dark:hover:bg-white/5 opacity-70'
          }`}
          style={{
            backgroundColor: filterType === 'ARCHIVED' ? activeTheme.accent : 'transparent',
          }}
        >
          ארכיון ({accounts.filter((a) => a.status === 'ARCHIVED').length})
        </button>
      </div>

      {/* Account Cards Grid */}
      {displayedAccounts.length === 0 ? (
        <div
          className="p-12 text-center rounded-xl border border-dashed space-y-3"
          style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}
        >
          <Landmark className="w-10 h-10 mx-auto opacity-30" style={{ color: activeTheme.accent }} />
          <h3 className="font-serif text-lg font-bold">אין חשבונות פיננסיים להצגה בקטגוריה זו</h3>
          <p className="text-xs max-w-md mx-auto opacity-70">
            הקם חשבונות בנק, כרטיסי אשראי או קופות חיסכון כדי לבנות את התשתית הפיננסית של משק הבית.
          </p>
          {canEdit && (
            <button
              onClick={() => {
                setEditingAccount(null);
                setModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded text-white shadow-xs hover:opacity-90 transition-opacity"
              style={{ backgroundColor: activeTheme.accent }}
            >
              <Plus className="w-4 h-4" />
              <span>הוסף חשבון חדש</span>
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayedAccounts.map((acc) => {
            const isNegative = acc.currentBalance < 0;
            return (
              <div
                key={acc.id}
                className="p-5 rounded-xl border transition-shadow hover:shadow-md flex flex-col justify-between space-y-4"
                style={{
                  backgroundColor: activeTheme.bgCard,
                  borderColor: activeTheme.borderSubtle,
                }}
              >
                {/* Card Top: Type & Institution */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="p-1.5 rounded-md bg-black/5 dark:bg-white/5">
                        {getAccountTypeIcon(acc.type)}
                      </span>
                      <span className="text-[11px] font-medium tracking-wide" style={{ color: activeTheme.textSecondary }}>
                        {getAccountTypeLabel(acc.type)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {acc.accountNumberLast4 && (
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded border border-black/10 dark:border-white/10 opacity-70">
                          •••• {acc.accountNumberLast4}
                        </span>
                      )}
                      {acc.status === 'ARCHIVED' && (
                        <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                          בארכיון
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Account Name & Bank */}
                  <div>
                    <h3 className="font-serif text-lg font-bold leading-tight">{acc.name}</h3>
                    <div className="text-xs font-medium opacity-70">{acc.institution}</div>
                  </div>
                </div>

                {/* Balance Display */}
                <div className="pt-2 border-t" style={{ borderColor: activeTheme.borderSubtle }}>
                  <div className="text-[10px] uppercase tracking-wider font-mono opacity-50">יתרה נוכחית</div>
                  <div
                    className={`font-serif text-2xl font-bold tabular-nums tracking-tight ${
                      isNegative ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-700 dark:text-emerald-400'
                    }`}
                  >
                    {formatCurrency(acc.currentBalance, acc.currency)}
                  </div>

                  {/* Metadata Row */}
                  <div className="flex items-center gap-3 pt-2 text-[11px] opacity-75">
                    <div>
                      <span className="opacity-60">פתיחה: </span>
                      <span className="font-mono tabular-nums">{formatCurrency(acc.openingBalance, acc.currency)}</span>
                    </div>

                    {acc.creditLimit !== undefined && (
                      <div>
                        <span className="opacity-60">מסגרת: </span>
                        <span className="font-mono tabular-nums">{formatCurrency(acc.creditLimit, acc.currency)}</span>
                      </div>
                    )}

                    {acc.interestRate !== undefined && (
                      <div>
                        <span className="opacity-60">ריבית: </span>
                        <span className="font-mono tabular-nums">{acc.interestRate}%</span>
                      </div>
                    )}
                  </div>

                  {acc.notes && (
                    <div className="text-[11px] opacity-70 italic line-clamp-1 mt-1.5">"{acc.notes}"</div>
                  )}
                </div>

                {/* Card Actions */}
                {canEdit && (
                  <div
                    className="pt-3 border-t flex items-center justify-between gap-2"
                    style={{ borderColor: activeTheme.borderSubtle }}
                  >
                    <div className="flex items-center gap-1.5">
                      {onOpenLedgerForAccount && (
                        <button
                          onClick={() => onOpenLedgerForAccount(acc.id)}
                          className="p-1.5 rounded bg-black/5 dark:bg-white/5 hover:bg-black/10 transition-colors text-xs flex items-center gap-1 font-medium"
                          title="צפה בתנועות חשבון זה בספר העסקאות"
                        >
                          <FileText className="w-3.5 h-3.5 text-amber-700" />
                          <span>עסקאות</span>
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setEditingAccount(acc);
                          setModalOpen(true);
                        }}
                        className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-xs flex items-center gap-1 opacity-80 hover:opacity-100"
                        title="ערוך פרטי חשבון"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                        <span>עריכה</span>
                      </button>

                      <button
                        onClick={() => onArchiveAccount(acc.id)}
                        className="p-1.5 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors text-xs flex items-center gap-1 opacity-80 hover:opacity-100"
                        title={acc.status === 'ARCHIVED' ? 'שחזר מארכיון' : 'העבר לארכיון'}
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>{acc.status === 'ARCHIVED' ? 'הפעל' : 'ארכב'}</span>
                      </button>
                    </div>

                    <div>
                      {deleteConfirmId === acc.id ? (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              onDeleteAccount(acc.id);
                              setDeleteConfirmId(null);
                            }}
                            className="px-2 py-1 text-[11px] rounded bg-rose-600 text-white font-medium hover:bg-rose-700 transition-colors"
                          >
                            אישור מחיקה
                          </button>
                          <button
                            onClick={() => setDeleteConfirmId(null)}
                            className="px-2 py-1 text-[11px] rounded border hover:bg-black/5 text-xs"
                          >
                            ביטול
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setDeleteConfirmId(acc.id)}
                          className="p-1.5 rounded hover:bg-rose-50 dark:hover:bg-rose-950/30 text-rose-600 transition-colors opacity-70 hover:opacity-100"
                          title="מחק חשבון"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Account Modal */}
      <AccountModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingAccount(null);
        }}
        onSave={async (data) => {
          await onSaveAccount(data, editingAccount?.id);
        }}
        initialAccount={editingAccount}
        activeTheme={activeTheme}
        canEdit={canEdit}
      />
    </div>
  );
};

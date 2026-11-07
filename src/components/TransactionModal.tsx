import React, { useState } from 'react';
import { X, ArrowDownRight, ArrowUpRight, ArrowLeftRight, Calendar, Tag, Building2, FileText, AlertCircle } from 'lucide-react';
import { FinancialAccount, LedgerTransaction, TransactionType, VerificationStatus } from '../types.ts';
import { ThemeConfig } from '../lib/themes.ts';
import { toCents, fromCents, parseCurrencyInput } from '../lib/currency.ts';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveTransaction: (data: {
    accountId: string;
    date: string;
    valueDate?: string;
    amountCents: number;
    type: 'INCOME' | 'EXPENSE';
    category: string;
    payee: string;
    notes?: string;
    verificationStatus?: VerificationStatus;
  }) => Promise<void>;
  onSaveTransfer: (data: {
    fromAccountId: string;
    toAccountId: string;
    date: string;
    valueDate?: string;
    amountCents: number;
    category?: string;
    notes?: string;
  }) => Promise<void>;
  onUpdateTransaction?: (id: string, updates: Partial<LedgerTransaction>) => Promise<void>;
  initialTransaction?: LedgerTransaction | null;
  accounts: FinancialAccount[];
  activeTheme: ThemeConfig;
  canEdit: boolean;
}

const COMMON_EXPENSE_CATEGORIES = [
  'מזון וסופרמרקט',
  'דיור וחשבונות (שכירות, ארנונה, חשמל)',
  'תחבורה, דלק ורכב',
  'בריאות, רפואה וביטוחים',
  'חינוך, חוגים וילדים',
  'קניות, ביגוד והנעלה',
  'מסעדות, בתי קפה ובילוי',
  'תקשורת ואינטרנט',
  'הוצאות שונות',
];

const COMMON_INCOME_CATEGORIES = [
  'משכורת חודשית',
  'הכנסה מעסק / עצמאי',
  'קצבאות ביטוח לאומי',
  'החזר מס / תגמולים',
  'שכר דירה / הכנסה פסיבית',
  'מתנות ומענקים',
  'הכנסה אחרת',
];

const COMMON_TRANSFER_CATEGORIES = [
  'העברה פנימית',
  'פירעון כרטיס אשראי',
  'הפקדה לחיסכון',
  'משיכה מחיסכון',
  'תשלום הלוואה',
];

const getLocalDateInputValue = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSaveTransaction,
  onSaveTransfer,
  onUpdateTransaction,
  initialTransaction,
  accounts,
  activeTheme,
  canEdit,
}) => {
  const isEditing = Boolean(initialTransaction);
  const isExistingTransfer = initialTransaction?.type === 'TRANSFER';

  const [mode, setMode] = useState<TransactionType>(
    initialTransaction ? initialTransaction.type : 'EXPENSE'
  );

  // Form states
  const [accountId, setAccountId] = useState<string>(
    initialTransaction?.accountId || (accounts[0]?.id || '')
  );
  const [fromAccountId, setFromAccountId] = useState<string>(
    initialTransaction?.accountId || (accounts[0]?.id || '')
  );
  const [toAccountId, setToAccountId] = useState<string>(
    initialTransaction?.counterpartyAccountId ||
      (accounts.find((a) => a.id !== (initialTransaction?.accountId || accounts[0]?.id))?.id || '')
  );

  const [amountStr, setAmountStr] = useState<string>(
    initialTransaction ? String(fromCents(initialTransaction.amountCents)) : ''
  );
  const [date, setDate] = useState<string>(
    initialTransaction?.date || getLocalDateInputValue()
  );
  const [valueDate, setValueDate] = useState<string>(initialTransaction?.valueDate || '');
  const [category, setCategory] = useState<string>(initialTransaction?.category || 'מזון וסופרמרקט');
  const [customCategory, setCustomCategory] = useState<string>('');
  const [payee, setPayee] = useState<string>(initialTransaction?.payee || '');
  const [notes, setNotes] = useState<string>(initialTransaction?.notes || '');
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>(
    initialTransaction?.verificationStatus || 'VERIFIED'
  );

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const selectedCurrency = accounts.find(account => account.id === (mode === 'TRANSFER' ? fromAccountId : accountId))?.currency || 'ILS';
  const selectedCurrencySymbol = new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: selectedCurrency,
    currencyDisplay: 'narrowSymbol',
  }).formatToParts(1).find(part => part.type === 'currency')?.value || selectedCurrency;

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!canEdit) {
      setError('אין לך הרשאת עריכה פיננסית במשק בית זה');
      return;
    }

    const parsedAmount = parseCurrencyInput(amountStr);
    if (!parsedAmount.valid || parsedAmount.cents <= 0) {
      setError('יש להזין סכום תקין וגדול מאפס');
      return;
    }
    const amountCents = parsedAmount.cents;

    if (!date) {
      setError('יש לבחור תאריך לעסקה');
      return;
    }

    const finalCategory = (category === 'אחר' && customCategory.trim() ? customCategory : category).trim();
    if (!finalCategory) {
      setError('יש להגדיר קטגוריה לעסקה');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && initialTransaction) {
        if (onUpdateTransaction) {
          await onUpdateTransaction(initialTransaction.id, {
            amountCents,
            date,
            valueDate: valueDate || undefined,
            category: finalCategory,
            payee: payee.trim() || initialTransaction.payee,
            notes: notes.trim() || undefined,
            verificationStatus,
          });
        }
      } else if (mode === 'TRANSFER') {
        if (!fromAccountId || !toAccountId) {
          setError('יש לבחור חשבון מקור וחשבון יעד להעברה');
          setIsSubmitting(false);
          return;
        }
        if (fromAccountId === toAccountId) {
          setError('חשבון מקור וחשבון יעד חייבים להיות שונים');
          setIsSubmitting(false);
          return;
        }
        const fromCurrency = accounts.find(account => account.id === fromAccountId)?.currency;
        const toCurrency = accounts.find(account => account.id === toAccountId)?.currency;
        if (fromCurrency && toCurrency && fromCurrency !== toCurrency) {
          setError('העברה ישירה אפשרית רק בין חשבונות באותו מטבע. המרה בין מטבעות דורשת שער המרה מאומת.');
          setIsSubmitting(false);
          return;
        }

        await onSaveTransfer({
          fromAccountId,
          toAccountId,
          date,
          valueDate: valueDate || undefined,
          amountCents,
          category: finalCategory,
          notes: notes.trim() || undefined,
        });
      } else {
        if (!accountId) {
          setError('יש לבחור חשבון משויך');
          setIsSubmitting(false);
          return;
        }
        if (!payee.trim()) {
          setError(mode === 'INCOME' ? 'יש לציין מקור הכנסה / מעסיק' : 'יש לציין שם בית עסק / מוטב');
          setIsSubmitting(false);
          return;
        }

        await onSaveTransaction({
          accountId,
          date,
          valueDate: valueDate || undefined,
          amountCents,
          type: mode,
          category: finalCategory,
          payee: payee.trim(),
          notes: notes.trim() || undefined,
          verificationStatus,
        });
      }

      onClose();
    } catch (err: any) {
      setError(err.message || 'שגיאה בשמירת העסקה');
    } finally {
      setIsSubmitting(false);
    }
  };

  const categoriesToUse =
    mode === 'INCOME'
      ? COMMON_INCOME_CATEGORIES
      : mode === 'EXPENSE'
      ? COMMON_EXPENSE_CATEGORIES
      : COMMON_TRANSFER_CATEGORIES;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm overflow-y-auto animate-fadeIn"
      dir="rtl"
    >
      <div
        className="w-full max-w-lg my-8 rounded-2xl border shadow-2xl overflow-hidden transition-all"
        style={{
          backgroundColor: activeTheme.bgCard,
          borderColor: activeTheme.borderSubtle,
        }}
      >
        {/* Modal Header */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b"
          style={{ borderColor: activeTheme.borderSubtle }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl border flex items-center justify-center"
              style={{
                backgroundColor: `${activeTheme.accent}15`,
                borderColor: `${activeTheme.accent}30`,
                color: activeTheme.accent,
              }}
            >
              {mode === 'INCOME' && <ArrowDownRight className="w-5 h-5 text-emerald-600" />}
              {mode === 'EXPENSE' && <ArrowUpRight className="w-5 h-5 text-amber-700" />}
              {mode === 'TRANSFER' && <ArrowLeftRight className="w-5 h-5 text-blue-600" />}
            </div>
            <div>
              <h3 className="font-serif text-xl font-bold tracking-tight text-stone-900">
                {isEditing
                  ? 'עריכת עסקה בספר'
                  : mode === 'TRANSFER'
                  ? 'העברה פנימית בין חשבונות'
                  : mode === 'INCOME'
                  ? 'רישום הכנסה חדשה'
                  : 'רישום הוצאה חדשה'}
              </h3>
              <p className="text-xs text-stone-500 font-sans mt-0.5">
                {isEditing
                  ? 'עדכון נתוני עסקה קיימת'
                  : 'הזנת תנועה כספית בספר העסקאות הראשי'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mx-6 mt-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Mode Selector (Only when creating new transaction) */}
          {!isEditing && (
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-2">
                סוג הפעולה
              </label>
              <div className="grid grid-cols-3 gap-2 p-1 bg-stone-100 rounded-xl border border-stone-200">
                <button
                  type="button"
                  onClick={() => {
                    setMode('EXPENSE');
                    setCategory(COMMON_EXPENSE_CATEGORIES[0]);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                    mode === 'EXPENSE'
                      ? 'bg-white text-stone-900 shadow-sm font-bold border border-stone-200/80'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <ArrowUpRight className="w-3.5 h-3.5 text-amber-700" />
                  <span>הוצאה</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('INCOME');
                    setCategory(COMMON_INCOME_CATEGORIES[0]);
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                    mode === 'INCOME'
                      ? 'bg-white text-stone-900 shadow-sm font-bold border border-stone-200/80'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <ArrowDownRight className="w-3.5 h-3.5 text-emerald-600" />
                  <span>הכנסה</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('TRANSFER');
                    setCategory('העברה פנימית');
                  }}
                  className={`py-2 px-3 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                    mode === 'TRANSFER'
                      ? 'bg-white text-stone-900 shadow-sm font-bold border border-stone-200/80'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600" />
                  <span>העברה</span>
                </button>
              </div>
            </div>
          )}

          {/* Amount and Date row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                סכום ({selectedCurrency}) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-stone-300 font-mono text-base font-semibold focus:outline-none focus:ring-2 focus:ring-amber-700/20 focus:border-amber-700"
                  dir="ltr"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 font-mono text-sm">
                  {selectedCurrencySymbol}
                </span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                תאריך עסקה *
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-amber-700/20 focus:border-amber-700"
                />
              </div>
            </div>
          </div>

          {/* Transfer Accounts or Single Account */}
          {mode === 'TRANSFER' && !isEditing ? (
            <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 space-y-3">
              <div className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                <ArrowLeftRight className="w-3.5 h-3.5 text-blue-600" />
                <span>הגדרת חשבונות העברה פנימית (שתי רגליים מקושרות)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    חשבון מקור (משיכה) *
                  </label>
                  <select
                    value={fromAccountId}
                    onChange={(e) => setFromAccountId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs bg-white focus:outline-none focus:border-blue-500"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name} ({a.institution})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-stone-600 mb-1">
                    חשבון יעד (הפקדה) *
                  </label>
                  <select
                    value={toAccountId}
                    onChange={(e) => setToAccountId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 text-xs bg-white focus:outline-none focus:border-blue-500"
                  >
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id} disabled={a.id === fromAccountId || a.currency !== selectedCurrency}>
                        {a.name} ({a.institution}) {a.id === fromAccountId ? '(חשבון מקור)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <p className="text-[11px] text-blue-700/90 leading-relaxed">
                העברות פנימיות מתבצעות בין חשבונות באותו מטבע בלבד, מעדכנות את שתי היתרות ואינן נחשבות כהכנסה או הוצאה נוספת בתקציב.
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                חשבון משויך *
              </label>
              <select
                disabled={isEditing}
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-sm font-sans bg-white focus:outline-none focus:ring-2 focus:ring-amber-700/20 focus:border-amber-700 disabled:bg-stone-100 disabled:text-stone-500"
              >
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} • {a.institution}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Payee / Merchant (Not needed for transfers as it's automatically named) */}
          {mode !== 'TRANSFER' && (
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                {mode === 'INCOME' ? 'מקור ההכנסה / משלם *' : 'שם בית עסק / מוטב *'}
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder={mode === 'INCOME' ? 'למשל: מקום עבודה, לקוח' : 'למשל: סופר פארם, שופרסל, תחנת דלק'}
                  value={payee}
                  onChange={(e) => setPayee(e.target.value)}
                  className="w-full pl-3 pr-9 py-2.5 rounded-xl border border-stone-300 text-sm font-sans focus:outline-none focus:ring-2 focus:ring-amber-700/20 focus:border-amber-700"
                />
                <Building2 className="w-4 h-4 text-stone-400 absolute right-3 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          )}

          {/* Category selection */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              קטגוריה *
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl border border-stone-300 text-sm font-sans bg-white focus:outline-none focus:ring-2 focus:ring-amber-700/20 focus:border-amber-700 mb-2"
            >
              {categoriesToUse.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
              <option value="אחר">אחר (הגדרה ידנית)...</option>
            </select>
            {category === 'אחר' && (
              <input
                type="text"
                placeholder="הקלד שם קטגוריה חדשה..."
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-sans focus:outline-none focus:border-amber-700"
              />
            )}
          </div>

          {/* Value Date & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                תאריך ערך (אופציונלי)
              </label>
              <input
                type="date"
                value={valueDate}
                onChange={(e) => setValueDate(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-sans focus:outline-none focus:border-amber-700"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-stone-700 mb-1.5">
                סטטוס אימות
              </label>
              <select
                value={verificationStatus}
                onChange={(e) => setVerificationStatus(e.target.value as VerificationStatus)}
                className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-sans bg-white focus:outline-none focus:border-amber-700"
              >
                <option value="VERIFIED">מאומת</option>
                <option value="PENDING">ממתין לאימות</option>
                <option value="RECONCILED">מותאם לדף חשבון</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              הערות ופרטים נוספים
            </label>
            <input
              type="text"
              placeholder="מספר קבלה, תיאור פריט, תשלום 1 מתוך 3 וכד'..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-stone-300 text-xs font-sans focus:outline-none focus:border-amber-700"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-stone-300 text-stone-700 text-xs font-medium hover:bg-stone-50 transition-colors"
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !canEdit}
              className="px-5 py-2.5 rounded-xl text-white text-xs font-bold transition-all shadow-sm hover:opacity-95 disabled:opacity-50"
              style={{ backgroundColor: activeTheme.accent }}
            >
              {isSubmitting ? 'שומר...' : isEditing ? 'שמור שינויים' : 'רישום בספר העסקאות'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};






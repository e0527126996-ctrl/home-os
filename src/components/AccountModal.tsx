import React, { useEffect, useState } from 'react';
import { X, CreditCard, Landmark, PiggyBank, FileText, Percent, ShieldAlert } from 'lucide-react';
import { AccountCurrency, AccountType, FinancialAccount } from '../types.ts';
import { parseCurrencyInput } from '../lib/currency.ts';
import { ThemeConfig } from '../lib/themes.ts';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (data: {
    name: string;
    type: AccountType;
    institution: string;
    accountNumberLast4?: string;
    currency: AccountCurrency;
    openingBalance: number;
    creditLimit?: number;
    interestRate?: number;
    notes?: string;
  }) => Promise<void>;
  initialAccount?: FinancialAccount | null;
  activeTheme: ThemeConfig;
  canEdit: boolean;
}

const COMMON_INSTITUTIONS = [
  'בנק הפועלים',
  'בנק לאומי',
  'בנק דיסקונט',
  'בנק מזרחי טפחות',
  'הבנק הבינלאומי',
  'וואן זירו (ONE ZERO)',
  'בנק יהב',
  'בנק מסד',
  'בנק ירושלים',
  'ישראכרט',
  'כאל (Cal)',
  'מקס (Max)',
  'אלטשולר שחם',
  'מיטב דש',
  'הראל',
  'מגדל',
  'מנורה מבטחים',
  'אחר',
];

export const AccountModal: React.FC<AccountModalProps> = ({
  isOpen,
  onClose,
  onSave,
  initialAccount,
  activeTheme,
  canEdit,
}) => {
  const isEditing = Boolean(initialAccount);

  const [type, setType] = useState<AccountType>(initialAccount?.type || 'CHECKING');
  const [name, setName] = useState(initialAccount?.name || '');
  const [institution, setInstitution] = useState(initialAccount?.institution || 'בנק הפועלים');
  const [customInstitution, setCustomInstitution] = useState('');
  const [accountNumberLast4, setAccountNumberLast4] = useState(initialAccount?.accountNumberLast4 || '');
  const [currency, setCurrency] = useState<AccountCurrency>(initialAccount?.currency || 'ILS');
  const [openingBalance, setOpeningBalance] = useState<string>(
    initialAccount !== undefined && initialAccount !== null ? String(initialAccount.openingBalance) : '0'
  );
  const [creditLimit, setCreditLimit] = useState<string>(
    initialAccount?.creditLimit !== undefined ? String(initialAccount.creditLimit) : ''
  );
  const [interestRate, setInterestRate] = useState<string>(
    initialAccount?.interestRate !== undefined ? String(initialAccount.interestRate) : ''
  );
  const [notes, setNotes] = useState(initialAccount?.notes || '');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // The modal stays mounted while closed. Refresh its fields whenever it is
  // opened for a new account so a previous edit cannot leak into this form.
  useEffect(() => {
    if (!isOpen) return;
    setType(initialAccount?.type || 'CHECKING');
    setName(initialAccount?.name || '');
    setInstitution(initialAccount?.institution || 'בנק הפועלים');
    setCustomInstitution('');
    setAccountNumberLast4(initialAccount?.accountNumberLast4 || '');
    setCurrency(initialAccount?.currency || 'ILS');
    setOpeningBalance(initialAccount ? String(initialAccount.openingBalance) : '0');
    setCreditLimit(initialAccount?.creditLimit !== undefined ? String(initialAccount.creditLimit) : '');
    setInterestRate(initialAccount?.interestRate !== undefined ? String(initialAccount.interestRate) : '');
    setNotes(initialAccount?.notes || '');
    setError(null);
    setIsSubmitting(false);
  }, [isOpen, initialAccount?.id]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('יש להזין שם עבור החשבון');
      return;
    }

    const finalInstitution = institution === 'אחר' ? customInstitution.trim() : institution;
    if (!finalInstitution) {
      setError('יש לבחור או להזין מוסד פיננסי');
      return;
    }

    const parsedBalance = parseCurrencyInput(openingBalance);
    if (!parsedBalance.valid) {
      setError(parsedBalance.error || 'יתרת הפתיחה אינה מספר חוקי');
      return;
    }

    const parsedLimit = creditLimit.trim() ? parseCurrencyInput(creditLimit) : undefined;
    if (parsedLimit && (!parsedLimit.valid || parsedLimit.cents < 0)) {
      setError(parsedLimit.error || 'מסגרת אשראי חייבת להיות מספר חיובי עם עד שתי ספרות אחרי הנקודה');
      return;
    }

    const interestPattern = /^\d+(?:\.\d{1,2})?$/;
    const parsedInterest = interestRate.trim() ? Number(interestRate) : undefined;
    if (parsedInterest !== undefined && (!interestPattern.test(interestRate.trim()) || !Number.isFinite(parsedInterest) || parsedInterest < 0)) {
      setError('שיעור הריבית חייב להיות מספר תקין עם עד שתי ספרות אחרי הנקודה');
      return;
    }

    if (accountNumberLast4 && !/^\d{4}$/.test(accountNumberLast4.trim())) {
      setError('4 ספרות אחרונות חייבות להכיל בדיוק 4 ספרות');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSave({
        name: name.trim(),
        type,
        institution: finalInstitution,
        accountNumberLast4: accountNumberLast4.trim() || undefined,
        currency,
        openingBalance: parsedBalance.cents / 100,
        creditLimit: parsedLimit !== undefined ? parsedLimit.cents / 100 : undefined,
        interestRate: parsedInterest !== undefined ? Number(parsedInterest) : undefined,
        notes: notes.trim() || undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'שגיאה בשמירת החשבון');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="homeos-themed-modal homeos-account-modal fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs">
      <div
        className="w-full max-w-xl rounded-xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
        style={{
          backgroundColor: activeTheme.bgSurface,
          borderColor: activeTheme.borderSubtle,
          color: activeTheme.textPrimary,
        }}
      >
        {/* Header */}
        <div
          className="px-6 py-4 border-b flex items-center justify-between"
          style={{ borderColor: activeTheme.borderSubtle }}
        >
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider" style={{ color: activeTheme.accent }}>
              ניהול חשבונות פיננסיים · Phase 2
            </div>
            <h2 className="font-serif text-xl font-bold">
              {isEditing ? `עריכת חשבון: ${initialAccount?.name}` : 'הוספת חשבון פיננסי חדש'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-black/5 dark:hover:white/5 transition-colors"
          >
            <X className="w-5 h-5 opacity-70" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="p-3 text-xs rounded border border-rose-200 bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:border-rose-900/60 dark:text-rose-200 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {!canEdit && (
            <div className="p-3 text-xs rounded border border-amber-200 bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:border-amber-900/60 dark:text-amber-200 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
              <span>אין לך הרשאת כתיבה פיננסית. ניתן לצפות בפרטים בלבד.</span>
            </div>
          )}

          {/* Account Type Selector */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wider mb-2" style={{ color: activeTheme.textSecondary }}>
              סוג חשבון פיננסי
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setType('CHECKING')}
                disabled={!canEdit}
                className={`p-3 rounded-lg border text-right transition-all flex flex-col justify-between ${
                  type === 'CHECKING' ? 'ring-2' : 'hover:opacity-90'
                }`}
                style={{
                  backgroundColor: type === 'CHECKING' ? activeTheme.accentMuted : activeTheme.bgCard,
                  borderColor: type === 'CHECKING' ? activeTheme.accent : activeTheme.borderSubtle,
                }}
              >
                <Landmark className="w-4 h-4 mb-2" style={{ color: activeTheme.accent }} />
                <div>
                  <div className="text-xs font-bold">חשבון עו"ש</div>
                  <div className="text-[10px] opacity-70">משכורות ושוטף</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('CREDIT_CARD')}
                disabled={!canEdit}
                className={`p-3 rounded-lg border text-right transition-all flex flex-col justify-between ${
                  type === 'CREDIT_CARD' ? 'ring-2' : 'hover:opacity-90'
                }`}
                style={{
                  backgroundColor: type === 'CREDIT_CARD' ? activeTheme.accentMuted : activeTheme.bgCard,
                  borderColor: type === 'CREDIT_CARD' ? activeTheme.accent : activeTheme.borderSubtle,
                }}
              >
                <CreditCard className="w-4 h-4 mb-2" style={{ color: activeTheme.accent }} />
                <div>
                  <div className="text-xs font-bold">כרטיס אשראי</div>
                  <div className="text-[10px] opacity-70">מסגרת וחיובים</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('SAVINGS')}
                disabled={!canEdit}
                className={`p-3 rounded-lg border text-right transition-all flex flex-col justify-between ${
                  type === 'SAVINGS' ? 'ring-2' : 'hover:opacity-90'
                }`}
                style={{
                  backgroundColor: type === 'SAVINGS' ? activeTheme.accentMuted : activeTheme.bgCard,
                  borderColor: type === 'SAVINGS' ? activeTheme.accent : activeTheme.borderSubtle,
                }}
              >
                <PiggyBank className="w-4 h-4 mb-2" style={{ color: activeTheme.accent }} />
                <div>
                  <div className="text-xs font-bold">חיסכון והשקעות</div>
                  <div className="text-[10px] opacity-70">פיקדונות וקרנות</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setType('LOAN_MORTGAGE')}
                disabled={!canEdit}
                className={`p-3 rounded-lg border text-right transition-all flex flex-col justify-between ${
                  type === 'LOAN_MORTGAGE' ? 'ring-2' : 'hover:opacity-90'
                }`}
                style={{
                  backgroundColor: type === 'LOAN_MORTGAGE' ? activeTheme.accentMuted : activeTheme.bgCard,
                  borderColor: type === 'LOAN_MORTGAGE' ? activeTheme.accent : activeTheme.borderSubtle,
                }}
              >
                <FileText className="w-4 h-4 mb-2" style={{ color: activeTheme.accent }} />
                <div>
                  <div className="text-xs font-bold">הלוואה / משכנתא</div>
                  <div className="text-[10px] opacity-70">התחייבות ארוכה</div>
                </div>
              </button>
            </div>
          </div>

          {/* Account Name & Institution */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">
                שם החשבון <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={!canEdit}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="לדוגמה: עו״ש משפחתי ראשי"
                className="w-full px-3 py-2 text-xs rounded border focus:outline-hidden"
                style={{
                  backgroundColor: activeTheme.bgCard,
                  borderColor: activeTheme.borderSubtle,
                  color: activeTheme.textPrimary,
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                מוסד פיננסי / בנק <span className="text-rose-500">*</span>
              </label>
              <select
                disabled={!canEdit}
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded border focus:outline-hidden"
                style={{
                  backgroundColor: activeTheme.bgCard,
                  borderColor: activeTheme.borderSubtle,
                  color: activeTheme.textPrimary,
                }}
              >
                {COMMON_INSTITUTIONS.map((inst) => (
                  <option key={inst} value={inst}>
                    {inst}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Custom Institution name if "Other" */}
          {institution === 'אחר' && (
            <div>
              <label className="block text-xs font-medium mb-1">
                הזן את שם המוסד הפיננסי <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                disabled={!canEdit}
                value={customInstitution}
                onChange={(e) => setCustomInstitution(e.target.value)}
                placeholder="לדוגמה: בנק זר, קרן עצמאית"
                className="w-full px-3 py-2 text-xs rounded border focus:outline-hidden"
                style={{
                  backgroundColor: activeTheme.bgCard,
                  borderColor: activeTheme.borderSubtle,
                  color: activeTheme.textPrimary,
                }}
              />
            </div>
          )}

          {/* Currency, Last 4 digits, Opening Balance */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1">מטבע החשבון</label>
              <select
                disabled={!canEdit}
                value={currency}
                onChange={(e) => setCurrency(e.target.value as AccountCurrency)}
                className="w-full px-3 py-2 text-xs rounded border focus:outline-hidden"
                style={{
                  backgroundColor: activeTheme.bgCard,
                  borderColor: activeTheme.borderSubtle,
                  color: activeTheme.textPrimary,
                }}
              >
                <option value="ILS">₪ שקל חדש (ILS)</option>
                <option value="USD">$ דולר ארה"ב (USD)</option>
                <option value="EUR">€ אירו (EUR)</option>
                <option value="GBP">£ לירה שטרלינג (GBP)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">4 ספרות אחרונות (זיהוי)</label>
              <input
                type="text"
                maxLength={4}
                disabled={!canEdit}
                value={accountNumberLast4}
                onChange={(e) => setAccountNumberLast4(e.target.value.replace(/\D/g, ''))}
                placeholder="4821"
                className="w-full px-3 py-2 text-xs font-mono rounded border focus:outline-hidden text-center"
                style={{
                  backgroundColor: activeTheme.bgCard,
                  borderColor: activeTheme.borderSubtle,
                  color: activeTheme.textPrimary,
                }}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1">
                יתרת פתיחה <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                required
                disabled={!canEdit}
                value={openingBalance}
                onChange={(e) => setOpeningBalance(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 text-xs font-mono rounded border focus:outline-hidden text-left"
                style={{
                  backgroundColor: activeTheme.bgCard,
                  borderColor: activeTheme.borderSubtle,
                  color: activeTheme.textPrimary,
                }}
              />
              <div className="text-[10px] opacity-60 mt-0.5">
                {type === 'CREDIT_CARD' || type === 'LOAN_MORTGAGE' ? 'חובה/התחייבות יש להזין עם סימן מינוס (-)' : 'יתרה חיובית לזכות'}
              </div>
            </div>
          </div>

          {/* Conditional fields based on type */}
          {(type === 'CREDIT_CARD' || type === 'CHECKING') && (
            <div>
              <label className="block text-xs font-medium mb-1">
                {type === 'CREDIT_CARD' ? 'מסגרת אשראי חודשית (' + currency + ')' : 'מסגרת משיכת יתר / אוברדרפט (' + currency + ')'}
              </label>
              <input
                type="number"
                step="100"
                disabled={!canEdit}
                value={creditLimit}
                onChange={(e) => setCreditLimit(e.target.value)}
                placeholder="25000"
                className="w-full px-3 py-2 text-xs font-mono rounded border focus:outline-hidden"
                style={{
                  backgroundColor: activeTheme.bgCard,
                  borderColor: activeTheme.borderSubtle,
                  color: activeTheme.textPrimary,
                }}
              />
            </div>
          )}

          {(type === 'SAVINGS' || type === 'LOAN_MORTGAGE') && (
            <div>
              <label className="block text-xs font-medium mb-1">
                {type === 'SAVINGS' ? 'ריבית שנתית צפויה (%)' : 'שיעור ריבית משוקלל (%)'}
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  disabled={!canEdit}
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  placeholder="3.85"
                  className="w-full px-3 py-2 text-xs font-mono rounded border focus:outline-hidden"
                  style={{
                    backgroundColor: activeTheme.bgCard,
                    borderColor: activeTheme.borderSubtle,
                    color: activeTheme.textPrimary,
                  }}
                />
                <Percent className="w-3.5 h-3.5 absolute left-3 top-2.5 opacity-40 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium mb-1">הערות ותנאים לחשבון</label>
            <textarea
              rows={2}
              disabled={!canEdit}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="לדוגמה: חיוב ב-10 לחודש, פטור מדמי ניהול, תחנת יציאה בדצמבר..."
              className="w-full px-3 py-2 text-xs rounded border focus:outline-hidden resize-none"
              style={{
                backgroundColor: activeTheme.bgCard,
                borderColor: activeTheme.borderSubtle,
                color: activeTheme.textPrimary,
              }}
            />
          </div>

          {/* Footer actions */}
          <div className="pt-3 border-t flex items-center justify-end gap-2" style={{ borderColor: activeTheme.borderSubtle }}>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs rounded border hover:opacity-80 transition-opacity"
              style={{
                backgroundColor: activeTheme.bgCard,
                borderColor: activeTheme.borderSubtle,
                color: activeTheme.textPrimary,
              }}
            >
              ביטול
            </button>

            {canEdit && (
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 text-xs font-semibold rounded text-white shadow-xs hover:opacity-90 transition-opacity disabled:opacity-50"
                style={{ backgroundColor: activeTheme.accent }}
              >
                {isSubmitting ? 'שומר...' : isEditing ? 'עדכן חשבון' : 'הקם חשבון'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};

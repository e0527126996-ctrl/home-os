/**
 * HOME OS — Phase 1: Foundation & RBAC
 * Single Source of Truth Local-First Household Operating System
 */

import React, { useEffect, useState } from 'react';
import {
  Home,
  Users,
  ShieldCheck,
  History,
  Database,
  Download,
  CheckCircle2,
  AlertCircle,
  Settings,
  Sparkles,
} from 'lucide-react';
import { Header } from './components/Header.tsx';
import { HouseholdsView } from './components/HouseholdsView.tsx';
import { MembersAndPersonsView } from './components/MembersAndPersonsView.tsx';
import { AccountsView } from './components/AccountsView.tsx';
import { TransactionsLedgerView } from './components/TransactionsLedgerView.tsx';
import { TransactionModal } from './components/TransactionModal.tsx';
import { PermissionsModal } from './components/PermissionsModal.tsx';
import { AuditLogView } from './components/AuditLogView.tsx';
import { TestRunnerModal } from './components/TestRunnerModal.tsx';
import { ExportImportModal } from './components/ExportImportModal.tsx';
import { StandaloneExportModal } from './components/StandaloneExportModal.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { db } from './lib/db.ts';
import { MODERN_EDITORIAL_THEMES, ThemeConfig } from './lib/themes.ts';
import { generateStandaloneHomeOSHtml } from './lib/standaloneGenerator.ts';
import {
  AuditLog,
  FinancialAccount,
  Household,
  HouseholdMembership,
  HouseholdPerson,
  HouseholdPermissionRule,
  LedgerTransaction,
  Role,
  User,
} from './types.ts';

export default function App() {
  const [isInitializing, setIsInitializing] = useState(true);

  // Core State
  const [households, setHouseholds] = useState<Household[]>([]);
  const [activeHousehold, setActiveHousehold] = useState<Household | null>(null);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [memberships, setMemberships] = useState<HouseholdMembership[]>([]);
  const [persons, setPersons] = useState<HouseholdPerson[]>([]);
  const [accounts, setAccounts] = useState<FinancialAccount[]>([]);
  const [transactions, setTransactions] = useState<LedgerTransaction[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Navigation & Theme
  const [activeTab, setActiveTab] = useState<'overview' | 'accounts' | 'ledger' | 'members' | 'households' | 'audit'>('ledger');
  const [activeTheme, setActiveTheme] = useState<ThemeConfig>(MODERN_EDITORIAL_THEMES[0]);
  const [ledgerSelectedAccountId, setLedgerSelectedAccountId] = useState<string | null>(null);

  // Modal Dialogs
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showHouseholdsModal, setShowHouseholdsModal] = useState(false);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showTestsModal, setShowTestsModal] = useState(false);
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showExportHtmlModal, setShowExportHtmlModal] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<LedgerTransaction | null>(null);
  const [editingPermissionsFor, setEditingPermissionsFor] = useState<{
    membership: HouseholdMembership;
    targetUser: User;
    rules: HouseholdPermissionRule[];
  } | null>(null);

  // Toast feedback
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Initialize DB and load initial data
  const loadInitialData = async () => {
    try {
      await db.initDefaultSeed();

      const [allHhds, usersList] = await Promise.all([db.getHouseholds(), db.getUsers()]);

      setHouseholds(allHhds);
      setAllUsers(usersList);

      const savedHhdId = await db.getSetting<string>('active_household_id', allHhds[0]?.id || '');
      const savedUserId = await db.getSetting<string>('current_user_id', usersList[0]?.id || '');
      const savedThemeId = await db.getSetting<string>('theme', 'warm_editorial');

      const initialHhd = allHhds.find((h) => h.id === savedHhdId) || allHhds[0] || null;
      const initialUser = usersList.find((u) => u.id === savedUserId) || usersList[0] || null;
      const initialTheme = MODERN_EDITORIAL_THEMES.find((t) => t.id === savedThemeId) || MODERN_EDITORIAL_THEMES[0];

      setActiveHousehold(initialHhd);
      setCurrentUser(initialUser);
      setActiveTheme(initialTheme);

      if (initialHhd) {
        await reloadHouseholdData(initialHhd.id);
      }
    } catch (err: any) {
      console.error('Failed to initialize local database:', err);
      showToast('שגיאה באתחול מסד הנתונים המקומי: ' + err.message, 'error');
    } finally {
      setIsInitializing(false);
    }
  };

  const reloadHouseholdData = async (householdId: string) => {
    const [mems, prs, logs, accs, txs] = await Promise.all([
      db.getMembershipsByHousehold(householdId),
      db.getPersonsByHousehold(householdId),
      db.getAuditLogs(householdId, 100),
      db.getAccountsByHousehold(householdId),
      db.getTransactionsByHousehold(householdId),
    ]);
    setMemberships(mems);
    setPersons(prs);
    setAuditLogs(logs);
    setAccounts(accs);
    setTransactions(txs);
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Update root CSS variables when theme changes
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--bg-canvas', activeTheme.bgCanvas);
    root.style.setProperty('--bg-surface', activeTheme.bgSurface);
    root.style.setProperty('--bg-card', activeTheme.bgCard);
    root.style.setProperty('--border-subtle', activeTheme.borderSubtle);
    root.style.setProperty('--text-primary', activeTheme.textPrimary);
    root.style.setProperty('--text-secondary', activeTheme.textSecondary);
    root.style.setProperty('--accent', activeTheme.accent);
    root.style.setProperty('--accent-muted', activeTheme.accentMuted);

    if (activeTheme.isDark) {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [activeTheme]);

  // Handlers for Households
  const handleSelectHousehold = async (hhdId: string) => {
    const target = households.find((h) => h.id === hhdId);
    if (!target) return;
    setActiveHousehold(target);
    await db.setSetting('active_household_id', target.id);
    await reloadHouseholdData(target.id);
    showToast(`מעבר למשק בית: ${target.name}`);
    setShowHouseholdsModal(false);
  };

  const handleCreateHousehold = async (name: string, currency: string) => {
    if (!currentUser) return;
    const newHhd = await db.createHousehold(name, currency, currentUser.id, currentUser.email);
    const updatedHhds = await db.getHouseholds();
    setHouseholds(updatedHhds);
    setActiveHousehold(newHhd);
    await reloadHouseholdData(newHhd.id);
    showToast(`משק בית "${name}" נוצר בהצלחה`);
  };

  const handleUpdateHouseholdSettings = async (settings: Household['settings']) => {
    if (!activeHousehold) return;
    const updated = { ...activeHousehold, settings };
    await db.saveHousehold(updated);
    setActiveHousehold(updated);
    showToast('הגדרות התצוגה עודכנו בהצלחה');
  };

  // Handlers for Members and Persons
  const handleAddMember = async (userId: string, role: Role) => {
    if (!activeHousehold || !currentUser) return;
    await db.addMemberToHousehold(activeHousehold.id, userId, role, currentUser.id, currentUser.email);
    await reloadHouseholdData(activeHousehold.id);
    showToast('משתמש צורף בהצלחה למשק הבית');
  };

  const handleCreateAndAddUser = async (email: string, fullName: string, role: Role, pin: string) => {
    if (!activeHousehold || !currentUser) return;
    const newUser = await db.createUser(email, fullName, pin);
    const updatedUsers = await db.getUsers();
    setAllUsers(updatedUsers);
    await db.addMemberToHousehold(activeHousehold.id, newUser.id, role, currentUser.id, currentUser.email);
    await reloadHouseholdData(activeHousehold.id);
    showToast(`משתמש חדש (${fullName}) נוצר וצורף בהצלחה`);
  };

  const handleUpdateRole = async (membershipId: string, role: Role) => {
    if (!currentUser) return;
    await db.updateMemberRole(membershipId, role, currentUser.id, currentUser.email);
    if (activeHousehold) await reloadHouseholdData(activeHousehold.id);
    showToast('תפקיד עודכן בהצלחה');
  };

  const handleRemoveMember = async (membershipId: string) => {
    if (!currentUser) return;
    await db.removeMemberFromHousehold(membershipId, currentUser.id, currentUser.email);
    if (activeHousehold) await reloadHouseholdData(activeHousehold.id);
    showToast('משתמש הוסר ממשק הבית');
  };

  const handleAddPerson = async (data: Omit<HouseholdPerson, 'id' | 'householdId' | 'createdAt'>) => {
    if (!activeHousehold || !currentUser) return;
    await db.addPerson(activeHousehold.id, data, currentUser.id, currentUser.email);
    await reloadHouseholdData(activeHousehold.id);
    showToast(`בן בית "${data.displayName}" נוסף בהצלחה`);
  };

  const handleDeletePerson = async (personId: string) => {
    if (!activeHousehold || !currentUser) return;
    await db.deletePerson(personId, activeHousehold.id, currentUser.id, currentUser.email);
    await reloadHouseholdData(activeHousehold.id);
    showToast('בן בית הוסר מהמשפחה');
  };

  const handleConfigurePermissions = async (membership: HouseholdMembership, targetUser: User) => {
    const rules = await db.getPermissionsByMembership(membership.id);
    setEditingPermissionsFor({ membership, targetUser, rules });
  };

  const handleSavePermissions = async (rules: HouseholdPermissionRule[]) => {
    if (!editingPermissionsFor || !currentUser) return;
    await db.updatePermissions(
      editingPermissionsFor.membership.id,
      editingPermissionsFor.membership.householdId,
      rules,
      currentUser.id,
      currentUser.email
    );
    showToast('הרשאות התחום נשמרו בהצלחה');
  };

  // Handlers for Financial Accounts (Phase 2 - Sub-phase A)
  const handleSaveAccount = async (data: any, accountId?: string) => {
    if (!activeHousehold || !currentUser) return;
    try {
      if (accountId) {
        await db.updateAccount(activeHousehold.id, accountId, data, currentUser.id, currentUser.email);
        showToast('פרטי החשבון עודכנו בהצלחה');
      } else {
        await db.createAccount(activeHousehold.id, data, currentUser.id, currentUser.email);
        showToast(`חשבון "${data.name}" הוקם בהצלחה`);
      }
      await reloadHouseholdData(activeHousehold.id);
    } catch (err: any) {
      showToast('שגיאה בשמירת חשבון: ' + err.message, 'error');
    }
  };

  const handleArchiveAccount = async (accountId: string) => {
    if (!activeHousehold || !currentUser) return;
    try {
      await db.archiveAccount(activeHousehold.id, accountId, currentUser.id, currentUser.email);
      await reloadHouseholdData(activeHousehold.id);
      showToast('סטטוס החשבון עודכן');
    } catch (err: any) {
      showToast('שגיאה בארכוב: ' + err.message, 'error');
    }
  };

  const handleDeleteAccount = async (accountId: string) => {
    if (!activeHousehold || !currentUser) return;
    try {
      await db.deleteAccount(activeHousehold.id, accountId, currentUser.id, currentUser.email);
      await reloadHouseholdData(activeHousehold.id);
      showToast('החשבון הוסר בהצלחה');
    } catch (err: any) {
      showToast('שגיאה במחיקת חשבון: ' + err.message, 'error');
    }
  };

  const handleSeedDemoAccounts = async () => {
    if (!activeHousehold || !currentUser) return;
    try {
      await db.createAccount(
        activeHousehold.id,
        {
          name: 'עו"ש משפחתי ראשי',
          type: 'CHECKING',
          institution: 'בנק הפועלים',
          accountNumberLast4: '4821',
          currency: 'ILS',
          openingBalance: 18450.00,
          notes: 'משכורות שוטפות והוראות קבע',
          color: '#B45309',
        },
        currentUser.id,
        currentUser.email
      );

      await db.createAccount(
        activeHousehold.id,
        {
          name: 'כרטיס אשראי Gold',
          type: 'CREDIT_CARD',
          institution: 'ישראכרט',
          accountNumberLast4: '7190',
          currency: 'ILS',
          openingBalance: -3840.50,
          creditLimit: 25000,
          notes: 'כרטיס קניות שוטפות (חיוב ב-10 לחודש)',
          color: '#D97706',
        },
        currentUser.id,
        currentUser.email
      );

      await db.createAccount(
        activeHousehold.id,
        {
          name: 'קרן השתלמות וחיסכון לחירום',
          type: 'SAVINGS',
          institution: 'אלטשולר שחם',
          currency: 'ILS',
          openingBalance: 85000.00,
          interestRate: 4.2,
          notes: 'קרן נזילה לחירום והזדמנויות',
          color: '#059669',
        },
        currentUser.id,
        currentUser.email
      );

      await db.createAccount(
        activeHousehold.id,
        {
          name: 'משכנתא לדירה',
          type: 'LOAN_MORTGAGE',
          institution: 'בנק מזרחי טפחות',
          currency: 'ILS',
          openingBalance: -520000.00,
          interestRate: 3.85,
          notes: 'הלוואת משכנתא משולבת (מסלול פריים + קל"צ)',
          color: '#DC2626',
        },
        currentUser.id,
        currentUser.email
      );

      await reloadHouseholdData(activeHousehold.id);
      showToast('4 חשבונות משפחתיים הוקמו בהצלחה');
    } catch (err: any) {
      showToast('שגיאה בטעינת חשבונות: ' + err.message, 'error');
    }
  };

  // Handlers for Ledger Transactions & Transfers (Phase 2 - Sub-phase B)
  const handleSaveTransaction = async (data: {
    accountId: string;
    date: string;
    valueDate?: string;
    amountCents: number;
    type: 'INCOME' | 'EXPENSE';
    category: string;
    payee: string;
    notes?: string;
    verificationStatus?: any;
  }) => {
    if (!activeHousehold || !currentUser) return;
    try {
      await db.createTransaction(activeHousehold.id, data, currentUser.id, currentUser.email);
      await reloadHouseholdData(activeHousehold.id);
      showToast(data.type === 'INCOME' ? 'הכנסה נרשמה בהצלחה בספר' : 'הוצאה נרשמה בהצלחה בספר');
    } catch (err: any) {
      showToast('שגיאה ברישום עסקה: ' + err.message, 'error');
      throw err;
    }
  };

  const handleSaveTransfer = async (data: {
    fromAccountId: string;
    toAccountId: string;
    date: string;
    valueDate?: string;
    amountCents: number;
    category?: string;
    notes?: string;
  }) => {
    if (!activeHousehold || !currentUser) return;
    try {
      await db.createTransfer(activeHousehold.id, data, currentUser.id, currentUser.email);
      await reloadHouseholdData(activeHousehold.id);
      showToast('העברה פנימית בשתי רגליים מקושרות בוצעה בהצלחה');
    } catch (err: any) {
      showToast('שגיאה בביצוע העברה: ' + err.message, 'error');
      throw err;
    }
  };

  const handleUpdateTransaction = async (id: string, updates: Partial<LedgerTransaction>) => {
    if (!activeHousehold || !currentUser) return;
    try {
      await db.updateTransaction(activeHousehold.id, id, updates, currentUser.id, currentUser.email);
      await reloadHouseholdData(activeHousehold.id);
      showToast('העסקה עודכנה בהצלחה');
    } catch (err: any) {
      showToast('שגיאה בעדכון עסקה: ' + err.message, 'error');
      throw err;
    }
  };

  const handleDeleteTransaction = async (txId: string) => {
    if (!activeHousehold || !currentUser) return;
    try {
      await db.deleteTransaction(txId, activeHousehold.id, currentUser.id, currentUser.email);
      await reloadHouseholdData(activeHousehold.id);
      showToast('התנועה נמחקה בהצלחה והיתרות עודכנו');
    } catch (err: any) {
      showToast('שגיאה במחיקת עסקה: ' + err.message, 'error');
      throw err;
    }
  };

  const handleOpenLedgerForAccount = (accId: string) => {
    setLedgerSelectedAccountId(accId);
    setActiveTab('ledger');
  };

  // Theme selection
  const handleSelectTheme = async (themeId: string) => {
    const t = MODERN_EDITORIAL_THEMES.find((x) => x.id === themeId);
    if (t) {
      setActiveTheme(t);
      await db.setSetting('theme', themeId);
      showToast(`ערכת נושא: ${t.nameHe}`);
    }
  };

  const currentMembership = memberships.find((m) => m.userId === currentUser?.id);
  const isOwnerOrAdmin = currentMembership?.role === 'owner' || currentMembership?.role === 'admin';
  const canPerformFinance = isOwnerOrAdmin || (currentMembership?.role === 'member');

  if (isInitializing) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAF8F5] text-[#1E1B18] font-serif">
        <div className="text-center space-y-3">
          <div className="text-2xl font-bold tracking-tight">HOME OS</div>
          <div className="text-xs text-stone-500 font-sans">טוען מסד נתונים מקומי (IndexedDB)...</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen flex flex-col transition-colors duration-200"
      style={{
        backgroundColor: activeTheme.bgCanvas,
        color: activeTheme.textPrimary,
      }}
      dir="rtl"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-5 left-5 z-50 px-4 py-2.5 rounded-lg shadow-lg text-xs font-medium flex items-center gap-2 border transition-all ${
            toastMessage.type === 'success'
              ? 'bg-emerald-50 dark:bg-emerald-950 border-emerald-300 text-emerald-800 dark:text-emerald-200'
              : 'bg-rose-50 dark:bg-rose-950 border-rose-300 text-rose-800 dark:text-rose-200'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Top Header */}
      <Header
        household={activeHousehold}
        currentUser={currentUser}
        activeTheme={activeTheme}
        onThemeSelect={handleSelectTheme}
        onOpenHouseholds={() => setShowHouseholdsModal(true)}
        onOpenAuth={() => setShowAuthModal(true)}
        onOpenAudit={() => setShowAuditModal(true)}
        onOpenTests={() => setShowTestsModal(true)}
        onOpenBackup={() => setShowBackupModal(true)}
        onOpenExportHtml={() => setShowExportHtmlModal(true)}
      />

      {/* Main Body */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Navigation & Section Tabs */}
        <div
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b pb-3"
          style={{ borderColor: activeTheme.borderSubtle }}
        >
          {/* Main Module Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
            <button
              onClick={() => setActiveTab('accounts')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'accounts' ? 'text-white' : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              style={{
                backgroundColor: activeTab === 'accounts' ? activeTheme.accent : 'transparent',
              }}
            >
              <span>חשבונות ונכסים</span>
              <span className="font-mono text-[10px] opacity-80">({accounts.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('ledger')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'ledger' ? 'text-white' : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              style={{
                backgroundColor: activeTab === 'ledger' ? activeTheme.accent : 'transparent',
              }}
            >
              <span>ספר עסקאות מרכזי</span>
              <span className="font-mono text-[10px] opacity-80">({transactions.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('overview')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                activeTab === 'overview' ? 'text-white' : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              style={{
                backgroundColor: activeTab === 'overview' ? activeTheme.accent : 'transparent',
              }}
            >
              תמונת מצב
            </button>

            <button
              onClick={() => setActiveTab('members')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                activeTab === 'members' ? 'text-white' : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              style={{
                backgroundColor: activeTab === 'members' ? activeTheme.accent : 'transparent',
              }}
            >
              משתמשים ובני בית ({memberships.length + persons.length})
            </button>

            <button
              onClick={() => setActiveTab('households')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                activeTab === 'households' ? 'text-white' : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              style={{
                backgroundColor: activeTab === 'households' ? activeTheme.accent : 'transparent',
              }}
            >
              משקי בית ({households.length})
            </button>

            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3.5 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                activeTab === 'audit' ? 'text-white' : 'hover:bg-black/5 dark:hover:bg-white/5'
              }`}
              style={{
                backgroundColor: activeTab === 'audit' ? activeTheme.accent : 'transparent',
              }}
            >
              יומן ביקורת ({auditLogs.length})
            </button>
          </div>

          {/* Phase 2 Sub-phase B Status Marker */}
          <div
            className="flex items-center gap-2 self-start sm:self-auto text-xs px-2.5 py-1 rounded border font-mono"
            style={{
              backgroundColor: activeTheme.bgSurface,
              borderColor: activeTheme.borderSubtle,
              color: activeTheme.textSecondary,
            }}
          >
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>PHASE 2 · SUB-PHASE B ACTIVE</span>
          </div>
        </div>

        {/* Tab 1: Overview / Executive Pulse */}
        {activeTab === 'overview' && activeHousehold && (
          <div className="space-y-6">
            {/* Editorial Pulse Banner */}
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
                    תמונת בית מקומית · LOCAL-FIRST EXECUTIVE PULSE
                  </div>
                  <h1 className="font-serif text-2xl font-bold">{activeHousehold.name}</h1>
                  <p className="text-xs max-w-2xl leading-relaxed" style={{ color: activeTheme.textSecondary }}>
                    מערכת הפעלה עצמאית יציבה הפועלת כולה בתוך הדפדפן (IndexedDB). ללא שרת חיצוני, ללא תלויות ענן,
                    וברמת בידוד מלאה של הנתונים וההרשאות.
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setShowExportHtmlModal(true)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded text-white shadow-sm transition-all hover:opacity-90"
                    style={{ backgroundColor: activeTheme.accent }}
                  >
                    <Download className="w-4 h-4" />
                    <span>שמור HOME-OS.html מקומי</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Metric 1 */}
              <div
                className="p-5 rounded-lg border space-y-1"
                style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}
              >
                <div className="text-[11px] uppercase tracking-wider font-mono opacity-60">משתמשי כניסה (RBAC)</div>
                <div className="font-serif text-3xl font-bold tabular-nums">{memberships.length}</div>
                <div className="text-xs opacity-75">חשבונות מורשים למשק הבית</div>
              </div>

              {/* Metric 2 */}
              <div
                className="p-5 rounded-lg border space-y-1"
                style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}
              >
                <div className="text-[11px] uppercase tracking-wider font-mono opacity-60">בני הבית (Persons)</div>
                <div className="font-serif text-3xl font-bold tabular-nums">{persons.length}</div>
                <div className="text-xs opacity-75">נפשות ללא צורך בחשבון (ילדים/תלויים)</div>
              </div>

              {/* Metric 3 */}
              <div
                className="p-5 rounded-lg border space-y-1"
                style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}
              >
                <div className="text-[11px] uppercase tracking-wider font-mono opacity-60">משקי בית במכשיר</div>
                <div className="font-serif text-3xl font-bold tabular-nums">{households.length}</div>
                <div className="text-xs opacity-75">בידוד דיירים מוחלט (Tenant Isolation)</div>
              </div>

              {/* Metric 4 */}
              <div
                className="p-5 rounded-lg border space-y-1"
                style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}
              >
                <div className="text-[11px] uppercase tracking-wider font-mono opacity-60">יומני ביקורת (Audit)</div>
                <div className="font-serif text-3xl font-bold tabular-nums">{auditLogs.length}</div>
                <div className="text-xs opacity-75">רשומות מעקב בלתי מחיקות</div>
              </div>
            </div>

            {/* Phase 1 Verification Checklist Box */}
            <div
              className="p-5 rounded-lg border space-y-3"
              style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}
            >
              <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: activeTheme.borderSubtle }}>
                <h3 className="font-serif text-base font-semibold">אבני דרך שהושלמו בשלב Phase 1</h3>
                <button
                  onClick={() => setShowTestsModal(true)}
                  className="flex items-center gap-1 text-xs font-semibold hover:underline"
                  style={{ color: activeTheme.accent }}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>הרץ בדיקות אימות אוטומטיות (10/10)</span>
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs leading-relaxed">
                <div className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold shrink-0">✓</span>
                  <span><strong>קובץ עצמאי יחיד:</strong> נוצר <code>HOME-OS.html</code> שניתן להפעיל בדפדפן Chrome ללא כל שרת או התקנה.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold shrink-0">✓</span>
                  <span><strong>מנוע IndexedDB עמיד:</strong> שמירה מלאה של טבלאות <code>households</code>, <code>users</code>, <code>memberships</code>, <code>persons</code> ו-<code>audit_logs</code>.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold shrink-0">✓</span>
                  <span><strong>הפרדת משתמשים מבני בית:</strong> תמיכה בריבוי מבוגרים בעלי חשבון, לצד ילדים ותלויים ללא חשבון כניסה (כולל מקדם מנה והעדפות תזונה).</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold shrink-0">✓</span>
                  <span><strong>מערכת הרשאות תחום (RBAC):</strong> שליטה פרטנית בקריאה, כתיבה ואישור בתחומי כספים, מזון, מסמכים, נכסים ותכנון.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold shrink-0">✓</span>
                  <span><strong>בידוד נתונים מוחלט:</strong> שאילתות מסוננות ברמת ה-Data Layer לפי מזהה משק הבית הפעיל בלבד.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold shrink-0">✓</span>
                  <span><strong>יומן ביקורת (Audit Logs):</strong> תיעוד שוטף של כל פעולת הוספה, עדכון או מחיקה עם משתמש מבצע וחותמת זמן.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold shrink-0">✓</span>
                  <span><strong>גיבוי ושחזור JSON:</strong> ייצוא קובץ גיבוי מלא ושחזורו המיידי עם אימות תקינות מלא.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-emerald-600 font-bold shrink-0">✓</span>
                  <span><strong>שפת Modern Editorial:</strong> 12 ערכות נושא יוקרתיות, טיפוגרפיה סריפית קלאסית, ספרות טבלאיות, ועברית RTL מלאה.</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab: Accounts View (Phase 2 - Sub-phase A) */}
        {activeTab === 'accounts' && activeHousehold && (
          <AccountsView
            accounts={accounts}
            activeTheme={activeTheme}
            canEdit={canPerformFinance}
            currentUser={currentUser}
            onSaveAccount={handleSaveAccount}
            onArchiveAccount={handleArchiveAccount}
            onDeleteAccount={handleDeleteAccount}
            onSeedDemoAccounts={handleSeedDemoAccounts}
            onOpenLedgerForAccount={handleOpenLedgerForAccount}
          />
        )}

        {/* Tab: Central Transactions Ledger (Phase 2 - Sub-phase B) */}
        {activeTab === 'ledger' && activeHousehold && (
          <TransactionsLedgerView
            transactions={transactions}
            accounts={accounts}
            activeTheme={activeTheme}
            canEdit={canPerformFinance}
            onAddTransaction={() => {
              setEditingTransaction(null);
              setShowTransactionModal(true);
            }}
            onAddTransfer={() => {
              setEditingTransaction(null);
              setShowTransactionModal(true);
            }}
            onEditTransaction={(tx) => {
              setEditingTransaction(tx);
              setShowTransactionModal(true);
            }}
            onDeleteTransaction={handleDeleteTransaction}
            selectedAccountId={ledgerSelectedAccountId}
            onSelectAccount={(accId) => setLedgerSelectedAccountId(accId)}
          />
        )}

        {/* Tab 2: Members & Persons View */}
        {activeTab === 'members' && activeHousehold && (
          <MembersAndPersonsView
            household={activeHousehold}
            allUsers={allUsers}
            memberships={memberships}
            persons={persons}
            currentUser={currentUser}
            activeTheme={activeTheme}
            onAddMember={handleAddMember}
            onCreateAndAddUser={handleCreateAndAddUser}
            onUpdateRole={handleUpdateRole}
            onRemoveMember={handleRemoveMember}
            onAddPerson={handleAddPerson}
            onDeletePerson={handleDeletePerson}
            onConfigurePermissions={handleConfigurePermissions}
          />
        )}

        {/* Tab 3: Households View */}
        {activeTab === 'households' && (
          <HouseholdsView
            households={households}
            activeHousehold={activeHousehold}
            currentUser={currentUser}
            activeTheme={activeTheme}
            onSelectHousehold={handleSelectHousehold}
            onCreateHousehold={handleCreateHousehold}
            onUpdateSettings={handleUpdateHouseholdSettings}
          />
        )}

        {/* Tab 4: Audit Log View */}
        {activeTab === 'audit' && activeHousehold && (
          <AuditLogView
            logs={auditLogs}
            activeTheme={activeTheme}
            onRefresh={() => reloadHouseholdData(activeHousehold.id)}
          />
        )}
      </main>

      {/* Modal Dialogs */}
      {showAuthModal && (
        <AuthModal
          currentUser={currentUser}
          allUsers={allUsers}
          activeTheme={activeTheme}
          onClose={() => setShowAuthModal(false)}
          onSwitchUser={async (u) => {
            setCurrentUser(u);
            await db.setSetting('current_user_id', u.id);
            showToast(`מחובר כעת כ-${u.fullName}`);
          }}
          onCreateUser={async (email, fullName, pin) => {
            const u = await db.createUser(email, fullName, pin);
            const updated = await db.getUsers();
            setAllUsers(updated);
            showToast(`משתמש ${fullName} נוצר בהצלחה`);
            return u;
          }}
          onLogout={async () => {
            setCurrentUser(null);
            await db.setSetting('current_user_id', null);
            setShowAuthModal(false);
            showToast('סשן ננעל בהצלחה');
          }}
        />
      )}

      {showHouseholdsModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div
            className="w-full max-w-2xl rounded-xl border shadow-xl flex flex-col max-h-[90vh] overflow-hidden p-5"
            style={{
              backgroundColor: activeTheme.bgCard,
              borderColor: activeTheme.borderSubtle,
              color: activeTheme.textPrimary,
            }}
          >
            <HouseholdsView
              households={households}
              activeHousehold={activeHousehold}
              currentUser={currentUser}
              activeTheme={activeTheme}
              onSelectHousehold={handleSelectHousehold}
              onCreateHousehold={handleCreateHousehold}
              onUpdateSettings={handleUpdateHouseholdSettings}
              onClose={() => setShowHouseholdsModal(false)}
            />
            <div className="pt-4 flex justify-end">
              <button
                onClick={() => setShowHouseholdsModal(false)}
                className="px-4 py-1.5 text-xs rounded border"
                style={{ borderColor: activeTheme.borderSubtle }}
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {showAuditModal && activeHousehold && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div
            className="w-full max-w-4xl rounded-xl border shadow-xl flex flex-col max-h-[90vh] overflow-hidden p-5"
            style={{
              backgroundColor: activeTheme.bgCard,
              borderColor: activeTheme.borderSubtle,
              color: activeTheme.textPrimary,
            }}
          >
            <AuditLogView
              logs={auditLogs}
              activeTheme={activeTheme}
              onRefresh={() => reloadHouseholdData(activeHousehold.id)}
            />
            <div className="pt-4 flex justify-end">
              <button
                onClick={() => setShowAuditModal(false)}
                className="px-4 py-1.5 text-xs rounded border"
                style={{ borderColor: activeTheme.borderSubtle }}
              >
                סגור
              </button>
            </div>
          </div>
        </div>
      )}

      {showTestsModal && (
        <TestRunnerModal
          activeTheme={activeTheme}
          onClose={() => setShowTestsModal(false)}
          onTestsFinished={() => {
            if (activeHousehold) reloadHouseholdData(activeHousehold.id);
          }}
        />
      )}

      {showBackupModal && activeHousehold && (
        <ExportImportModal
          household={activeHousehold}
          currentUser={currentUser}
          activeTheme={activeTheme}
          onClose={() => setShowBackupModal(false)}
          onDataRestored={async () => {
            const hhds = await db.getHouseholds();
            setHouseholds(hhds);
            if (hhds[0]) {
              setActiveHousehold(hhds[0]);
              await reloadHouseholdData(hhds[0].id);
            }
            showToast('נתונים שוחזרו בהצלחה!');
          }}
        />
      )}

      {showExportHtmlModal && (
        <StandaloneExportModal
          activeTheme={activeTheme}
          onClose={() => setShowExportHtmlModal(false)}
          getStandaloneHtmlCode={generateStandaloneHomeOSHtml}
        />
      )}

      {editingPermissionsFor && (
        <PermissionsModal
          membership={editingPermissionsFor.membership}
          targetUser={editingPermissionsFor.targetUser}
          permissionRules={editingPermissionsFor.rules}
          activeTheme={activeTheme}
          onClose={() => setEditingPermissionsFor(null)}
          onSave={handleSavePermissions}
        />
      )}

      {showTransactionModal && (
        <TransactionModal
          isOpen={showTransactionModal}
          onClose={() => {
            setShowTransactionModal(false);
            setEditingTransaction(null);
          }}
          onSaveTransaction={handleSaveTransaction}
          onSaveTransfer={handleSaveTransfer}
          onUpdateTransaction={handleUpdateTransaction}
          initialTransaction={editingTransaction}
          accounts={accounts.filter((a) => a.status !== 'ARCHIVED')}
          activeTheme={activeTheme}
          canEdit={canPerformFinance}
        />
      )}
    </div>
  );
}

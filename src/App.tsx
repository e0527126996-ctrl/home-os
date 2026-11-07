/**
 * HOME OS — Phase 1: Foundation & RBAC
 * Single Source of Truth Local-First Household Operating System
 */

import React, { lazy, Suspense, useEffect, useState } from 'react';
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
  LayoutDashboard,
  WalletCards,
  ArrowLeftRight,
  UsersRound,
  House,
  ClipboardList,
  FolderOpen,
  Utensils,
} from 'lucide-react';
import { Header } from './components/Header.tsx';
import { SettingsView } from './components/SettingsView.tsx';
const DashboardView = lazy(() => import('./components/DashboardView.tsx').then(({ DashboardView }) => ({ default: DashboardView })));
const HouseholdsView = lazy(() => import('./components/HouseholdsView.tsx').then(({ HouseholdsView }) => ({ default: HouseholdsView })));
const MembersAndPersonsView = lazy(() => import('./components/MembersAndPersonsView.tsx').then(({ MembersAndPersonsView }) => ({ default: MembersAndPersonsView })));
const AccountsView = lazy(() => import('./components/AccountsView.tsx').then(({ AccountsView }) => ({ default: AccountsView })));
const TransactionsLedgerView = lazy(() => import('./components/TransactionsLedgerView.tsx').then(({ TransactionsLedgerView }) => ({ default: TransactionsLedgerView })));
const TransactionModal = lazy(() => import('./components/TransactionModal.tsx').then(({ TransactionModal }) => ({ default: TransactionModal })));
const PermissionsModal = lazy(() => import('./components/PermissionsModal.tsx').then(({ PermissionsModal }) => ({ default: PermissionsModal })));
const AuditLogView = lazy(() => import('./components/AuditLogView.tsx').then(({ AuditLogView }) => ({ default: AuditLogView })));
const TestRunnerModal = lazy(() => import('./components/TestRunnerModal.tsx').then(({ TestRunnerModal }) => ({ default: TestRunnerModal })));
const ExportImportModal = lazy(() => import('./components/ExportImportModal.tsx').then(({ ExportImportModal }) => ({ default: ExportImportModal })));
const StandaloneExportModal = lazy(() => import('./components/StandaloneExportModal.tsx').then(({ StandaloneExportModal }) => ({ default: StandaloneExportModal })));
const AuthModal = lazy(() => import('./components/AuthModal.tsx').then(({ AuthModal }) => ({ default: AuthModal })));
const DocumentCenterView = lazy(() => import('./components/DocumentCenterView.tsx').then(({ DocumentCenterView }) => ({ default: DocumentCenterView })));
const HomeManagementView = lazy(() => import('./components/HomeManagementView.tsx').then(({ HomeManagementView }) => ({ default: HomeManagementView })));
import { db } from './lib/db.ts';
import { MODERN_EDITORIAL_THEMES, ThemeConfig } from './lib/themes.ts';
import { BACKGROUND_PRESETS, DASHBOARD_WIDGETS, DEFAULT_DASHBOARD_WIDGET_ORDER, WorkspaceViewMode, WORKSPACE_VIEW_MODES } from './lib/workspace.ts';
import type { DashboardWidgetSize, WorkspaceBackgroundPresetId } from './lib/workspace.ts';
import { generateStandaloneHomeOSHtml } from './lib/standaloneGenerator.ts';
import type { ImportedStatementRow } from './lib/statementImport.ts';
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
  HouseholdHomeItem,
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
  const [homeItems, setHomeItems] = useState<HouseholdHomeItem[]>([]);
  const [currentPermissionRules, setCurrentPermissionRules] = useState<HouseholdPermissionRule[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  // Navigation & Theme
  const [activeTab, setActiveTab] = useState<'dashboard' | 'overview' | 'accounts' | 'ledger' | 'members' | 'households' | 'audit' | 'documents' | 'home' | 'settings'>('dashboard');
  const [homeManagementInitialTab, setHomeManagementInitialTab] = useState<'planner'|'recipes'|'shopping'|'tasks'|'finance'>('planner');
  const [activeTheme, setActiveTheme] = useState<ThemeConfig>(MODERN_EDITORIAL_THEMES[0]);
  const [workspaceDensity, setWorkspaceDensity] = useState<'compact' | 'balanced' | 'spacious'>('balanced');
  const [workspaceViewMode, setWorkspaceViewMode] = useState<WorkspaceViewMode>('executive');
  const [dashboardWidgetOrder, setDashboardWidgetOrder] = useState<string[]>(DEFAULT_DASHBOARD_WIDGET_ORDER);
  const [visibleDashboardWidgetIds, setVisibleDashboardWidgetIds] = useState<string[]>(DEFAULT_DASHBOARD_WIDGET_ORDER);
  const [dashboardWidgetSizes, setDashboardWidgetSizes] = useState<Record<string, DashboardWidgetSize>>({});
  const [personalBackgroundImage, setPersonalBackgroundImage] = useState<string | null>(null);
  const [backgroundPresetId, setBackgroundPresetId] = useState<WorkspaceBackgroundPresetId>('warm_linen');
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
      const [savedThemeId, savedDensity, savedViewMode, savedWidgetOrder, savedVisibleWidgets, savedWidgetSizes, savedBackgroundImage, savedBackgroundPreset] = await Promise.all([
        db.getSetting<string>('theme', 'warm_editorial'),
        db.getSetting<string>('workspace_density', 'balanced'),
        db.getSetting<WorkspaceViewMode>('workspace_view_mode', 'executive'),
        db.getSetting<string[]>('dashboard_widget_order', DEFAULT_DASHBOARD_WIDGET_ORDER),
        db.getSetting<string[]>('dashboard_widget_visibility', DEFAULT_DASHBOARD_WIDGET_ORDER),
        db.getSetting<Record<string, DashboardWidgetSize>>('dashboard_widget_sizes', {}),
        db.getSetting<string>('personal_background_image', ''),
        db.getSetting<WorkspaceBackgroundPresetId>('personal_background_preset', 'warm_linen'),
      ]);

      const initialHhd = allHhds.find((h) => h.id === savedHhdId) || allHhds[0] || null;
      const initialUser = usersList.find((u) => u.id === savedUserId) || usersList[0] || null;
      const initialTheme = MODERN_EDITORIAL_THEMES.find((t) => t.id === savedThemeId) || MODERN_EDITORIAL_THEMES[0];

      setActiveHousehold(initialHhd);
      setCurrentUser(initialUser);
      setActiveTheme(initialTheme);
      setWorkspaceDensity(savedDensity === 'compact' || savedDensity === 'spacious' ? savedDensity : 'balanced');
      setWorkspaceViewMode(WORKSPACE_VIEW_MODES.some((mode) => mode.id === savedViewMode) ? savedViewMode : 'executive');
      const validWidgetOrder = Array.isArray(savedWidgetOrder)
        ? savedWidgetOrder.filter((id, index) => DASHBOARD_WIDGETS.some((widget) => widget.id === id) && savedWidgetOrder.indexOf(id) === index)
        : [];
      setDashboardWidgetOrder([...validWidgetOrder, ...DEFAULT_DASHBOARD_WIDGET_ORDER.filter((id) => !validWidgetOrder.includes(id))]);
      setVisibleDashboardWidgetIds(Array.isArray(savedVisibleWidgets)
        ? savedVisibleWidgets.filter((id) => DASHBOARD_WIDGETS.some((widget) => widget.id === id))
        : [...DEFAULT_DASHBOARD_WIDGET_ORDER]);
      const normalizedWidgetSizes: Record<string, DashboardWidgetSize> = {};
      for (const widget of DASHBOARD_WIDGETS) {
        const size = savedWidgetSizes?.[widget.id];
        normalizedWidgetSizes[widget.id] = size === 'compact' || size === 'expanded' ? size : 'standard';
      }
      setDashboardWidgetSizes(normalizedWidgetSizes);
      setPersonalBackgroundImage(typeof savedBackgroundImage === 'string' && savedBackgroundImage.startsWith('data:image/') ? savedBackgroundImage : null);
      setBackgroundPresetId(BACKGROUND_PRESETS.some((preset) => preset.id === savedBackgroundPreset) ? savedBackgroundPreset : BACKGROUND_PRESETS[0].id);

      if (initialHhd) {
        await reloadHouseholdData(initialHhd.id, initialUser?.id);
      }
    } catch (err: any) {
      console.error('Failed to initialize local database:', err);
      showToast('שגיאה באתחול מסד הנתונים המקומי: ' + err.message, 'error');
    } finally {
      setIsInitializing(false);
    }
  };

  const reloadHouseholdData = async (householdId: string, actorUserId = currentUser?.id) => {
    const [mems, prs, logs, accs, txs, home] = await Promise.all([
      db.getMembershipsByHousehold(householdId),
      db.getPersonsByHousehold(householdId),
      db.getAuditLogs(householdId, 100),
      db.getAccountsByHousehold(householdId),
      db.getTransactionsByHousehold(householdId),
      actorUserId
        ? db.getHomeItemsByHousehold(householdId, actorUserId).catch((error) => {
            console.warn('Household operations data is unavailable for this member:', error);
            return [] as HouseholdHomeItem[];
          })
        : Promise.resolve([] as HouseholdHomeItem[]),
    ]);
    setMemberships(mems);
    setPersons(prs);
    setAuditLogs(logs);
    setAccounts(accs);
    setTransactions(txs);
    setHomeItems(home);
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  // Keep other open HOME OS tabs in sync after a committed IndexedDB write.
  // This is same-browser synchronization, not cloud or multi-device sync.
  useEffect(() => {
    if (!activeHousehold?.id || !currentUser?.id || typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel('home-os-data');
    channel.onmessage = (event: MessageEvent<{ type?: string; stores?: string[] }>) => {
      if (event.data?.type !== 'data-changed' || !Array.isArray(event.data.stores)) return;
      void reloadHouseholdData(activeHousehold.id, currentUser.id).catch((error) => {
        console.error('Failed to refresh HOME OS after another tab changed data:', error);
      });
    };
    return () => channel.close();
  }, [activeHousehold?.id, currentUser?.id]);

  // Update root CSS variables when theme changes
  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = activeTheme.id;
    root.dataset.viewMode = workspaceViewMode;
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
  }, [activeTheme, workspaceViewMode]);

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

  const handleImportTransactions = async (rows: ImportedStatementRow[], accountId: string) => {
    if (!activeHousehold || !currentUser) throw new Error('יש להתחבר למשק הבית לפני ייבוא עסקאות');
    try {
      const imported = await db.createImportedTransactionsBatch(
        activeHousehold.id,
        rows.map(row => ({
          accountId,
          date: row.date,
          amountCents: row.amountCents,
          type: row.type,
          category: row.category,
          payee: row.payee,
          notes: `מקור: ${row.sourceFileName || 'דף חשבון'} · ${row.sourceText.slice(0, 320)} · נדרש אימות מול המסמך המקורי`,
        })),
        currentUser.id,
        currentUser.email
      );
      await reloadHouseholdData(activeHousehold.id);
      showToast(`יובאו ${imported.length} עסקאות. כולן ממתינות לאימות ולא ישפיעו על היתרות עד לאישור.`);
    } catch (err: any) {
      await reloadHouseholdData(activeHousehold.id);
      showToast('ייבוא דף החשבון נכשל: ' + err.message, 'error');
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

  const handleDensityChange = async (density: 'compact' | 'balanced' | 'spacious') => {
    setWorkspaceDensity(density);
    await db.setSetting('workspace_density', density);
    showToast(`צפיפות סביבת העבודה עודכנה: ${density === 'compact' ? 'קומפקטי' : density === 'spacious' ? 'מרווח' : 'מאוזן'}`);
  };

  const handleWorkspaceViewModeChange = async (mode: WorkspaceViewMode) => {
    setWorkspaceViewMode(mode);
    await db.setSetting('workspace_view_mode', mode);
    showToast(`מצב העבודה עודכן: ${WORKSPACE_VIEW_MODES.find((item) => item.id === mode)?.nameHe || mode}`);
  };

  const handleDashboardWidgetToggle = async (widgetId: string, visible: boolean) => {
    if (!DASHBOARD_WIDGETS.some((widget) => widget.id === widgetId)) return;
    const next = visible
      ? [...new Set([...visibleDashboardWidgetIds, widgetId])]
      : visibleDashboardWidgetIds.filter((id) => id !== widgetId);
    setVisibleDashboardWidgetIds(next);
    await db.setSetting('dashboard_widget_visibility', next);
  };

  const handleDashboardWidgetSizeChange = async (widgetId: string, size: DashboardWidgetSize) => {
    if (!DASHBOARD_WIDGETS.some((widget) => widget.id === widgetId)) return;
    const next = { ...dashboardWidgetSizes, [widgetId]: size };
    setDashboardWidgetSizes(next);
    await db.setSetting('dashboard_widget_sizes', next);
  };

  const handleDashboardWidgetMove = async (widgetId: string, direction: 'up' | 'down') => {
    const current = [...dashboardWidgetOrder];
    const index = current.indexOf(widgetId);
    const target = direction === 'up' ? index - 1 : index + 1;
    if (index < 0 || target < 0 || target >= current.length) return;
    [current[index], current[target]] = [current[target], current[index]];
    setDashboardWidgetOrder(current);
    await db.setSetting('dashboard_widget_order', current);
  };

  const handleBackgroundPresetChange = async (presetId: WorkspaceBackgroundPresetId) => {
    if (!BACKGROUND_PRESETS.some((preset) => preset.id === presetId)) return;
    setBackgroundPresetId(presetId);
    await db.setSetting('personal_background_preset', presetId);
    if (personalBackgroundImage) {
      await db.setSetting('personal_background_image', '');
      setPersonalBackgroundImage(null);
    }
    showToast('הרקע החדש הוחל על סביבת העבודה');
  };

  const handleBackgroundImageChange = async (file: File | null) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('יש לבחור תמונת JPG, PNG או WebP', 'error');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      showToast('התמונה גדולה מדי. הגודל המרבי הוא 3MB', 'error');
      return;
    }
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('לא ניתן לקרוא את התמונה'));
        reader.onerror = () => reject(new Error('קריאת התמונה נכשלה'));
        reader.readAsDataURL(file);
      });
      await db.setSetting('personal_background_image', dataUrl);
      setPersonalBackgroundImage(dataUrl);
      showToast('תמונת הרקע נשמרה במכשיר');
    } catch (error: any) {
      showToast('לא ניתן לשמור את תמונת הרקע: ' + error.message, 'error');
    }
  };

  const handleBackgroundImageClear = async () => {
    await db.setSetting('personal_background_image', '');
    setPersonalBackgroundImage(null);
    showToast('תמונת הרקע הוסרה');
  };

  const currentMembership = memberships.find((m) => m.userId === currentUser?.id);
  const isOwnerOrAdmin = currentMembership?.role === 'owner' || currentMembership?.role === 'admin';

  useEffect(() => {
    let active = true;
    if (!currentMembership) {
      setCurrentPermissionRules([]);
      return () => { active = false; };
    }
    setCurrentPermissionRules([]);
    db.getPermissionsByMembership(currentMembership.id)
      .then((rules) => { if (active) setCurrentPermissionRules(rules); })
      .catch((error) => {
        console.error('Failed to load current household permissions:', error);
        if (active) setCurrentPermissionRules([]);
      });
    return () => { active = false; };
  }, [currentMembership?.id]);

  const canPerformFinance = isOwnerOrAdmin || (
    currentMembership?.role === 'member' &&
    currentPermissionRules.find((rule) => rule.domain === 'finance')?.canWrite === true
  );
  const canPerformFood = isOwnerOrAdmin || (
    currentMembership?.role === 'member' &&
    currentPermissionRules.find((rule) => rule.domain === 'food')?.canWrite === true
  );

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
      className={`homeos-app-shell homeos-density-${workspaceDensity} ${activeTheme.isDark ? 'dark' : ''} min-h-screen flex flex-col transition-colors duration-200`}
      style={{
        backgroundColor: activeTheme.bgCanvas,
        backgroundImage: personalBackgroundImage
          ? `linear-gradient(${activeTheme.isDark ? 'rgba(15,17,21,.66)' : 'rgba(250,248,245,.68)'}, ${activeTheme.isDark ? 'rgba(15,17,21,.72)' : 'rgba(250,248,245,.72)'}), url("${personalBackgroundImage}")`
          : BACKGROUND_PRESETS.find((preset) => preset.id === backgroundPresetId)?.background || BACKGROUND_PRESETS[0].background,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundAttachment: 'fixed',
        color: activeTheme.textPrimary,
        ...({
          '--homeos-accent': activeTheme.accent,
          '--homeos-accent-muted': activeTheme.accentMuted,
          '--homeos-canvas': activeTheme.bgCanvas,
          '--homeos-surface': activeTheme.bgSurface,
          '--homeos-card': activeTheme.bgCard,
          '--homeos-border': activeTheme.borderSubtle,
          '--homeos-text': activeTheme.textPrimary,
          '--homeos-muted': activeTheme.textSecondary,
          '--accent': activeTheme.accent,
          '--accent-muted': activeTheme.accentMuted,
          '--bg-canvas': activeTheme.bgCanvas,
          '--bg-surface': activeTheme.bgSurface,
          '--bg-card': activeTheme.bgCard,
          '--border-subtle': activeTheme.borderSubtle,
          '--text-primary': activeTheme.textPrimary,
          '--text-secondary': activeTheme.textSecondary,
          '--focus-ring': activeTheme.accent,
        } as React.CSSProperties),
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

      <Suspense fallback={<div className="flex min-h-48 items-center justify-center text-sm" style={{ color: activeTheme.textSecondary }}>טוען אזור עבודה...</div>}>
      {/* Main Body */}
      <main className="homeos-main-content flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-7 lg:px-10 py-7 space-y-8">
        {/* Premium primary navigation */}
        <section className="homeos-navigation-shell">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3 px-2">
            <div><div className="homeos-section-kicker">מרחב ניהול משק הבית</div><div className="mt-1 text-sm font-bold" style={{ color: activeTheme.textPrimary }}>מרחבי העבודה</div></div>
            <div className="flex flex-wrap items-center gap-2 text-[10px] font-semibold tabular-nums" style={{ color: activeTheme.textSecondary }}>
              <span className="homeos-workspace-stat"><span className="homeos-status-dot verified"/> {transactions.filter(tx => tx.verificationStatus !== 'PENDING').length} מאומתות</span>
              <span className="homeos-workspace-stat"><span className="homeos-status-dot pending"/> {transactions.filter(tx => tx.verificationStatus === 'PENDING').length} לאימות</span>
              <span className="homeos-workspace-stat">{accounts.length} חשבונות</span>
            </div>
          </div>
          <nav aria-label="ניווט ראשי" className="homeos-main-nav">
            {([
              { id: 'dashboard', label: 'לוח בקרה', icon: LayoutDashboard },
              { id: 'accounts', label: 'חשבונות ונכסים', icon: WalletCards, count: accounts.length },
              { id: 'ledger', label: 'פנקס עסקאות', icon: ArrowLeftRight, count: transactions.length },
              { id: 'documents', label: 'מרכז מסמכים', icon: FolderOpen },
              { id: 'home', label: 'ניהול הבית', icon: Utensils },
              { id: 'members', label: 'משפחה והרשאות', icon: UsersRound, count: memberships.length + persons.length },
              { id: 'households', label: 'משקי בית', icon: House, count: households.length },
              { id: 'audit', label: 'יומן ביקורת', icon: ClipboardList, count: auditLogs.length },
              { id: 'settings', label: 'הגדרות אישיות', icon: Settings },
            ] as const).map((item) => {
              const selected = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  aria-current={selected ? 'page' : undefined}
                  className="homeos-nav-item"
                  style={{
                    color: selected ? '#FFFFFF' : activeTheme.textSecondary,
                    background: selected ? `linear-gradient(135deg, color-mix(in srgb, ${activeTheme.accent} 78%, #17231d), ${activeTheme.accent})` : 'transparent',
                    boxShadow: selected ? '0 7px 18px rgba(36,72,60,.18)' : 'none',
                  }}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                  {'count' in item && <span className="rounded-md px-1.5 py-0.5 text-[10px] tabular-nums" style={{ backgroundColor: selected ? 'rgba(255,255,255,.16)' : activeTheme.bgSurface }}>{item.count}</span>}
                </button>
              );
            })}
          </nav>
        </section>

                <div className="homeos-workspace-content">

        {activeTab === 'settings' && (
          <SettingsView
            themes={MODERN_EDITORIAL_THEMES}
            activeTheme={activeTheme}
            onThemeSelect={handleSelectTheme}
            density={workspaceDensity}
            onDensityChange={handleDensityChange}
            workspaceViewMode={workspaceViewMode}
            onWorkspaceViewModeChange={handleWorkspaceViewModeChange}
            dashboardWidgetOrder={dashboardWidgetOrder}
            visibleDashboardWidgetIds={visibleDashboardWidgetIds}
            onDashboardWidgetToggle={handleDashboardWidgetToggle}
            onDashboardWidgetMove={handleDashboardWidgetMove}
            dashboardWidgetSizes={dashboardWidgetSizes}
            onDashboardWidgetSizeChange={handleDashboardWidgetSizeChange}
            backgroundImage={personalBackgroundImage}
            backgroundPresetId={backgroundPresetId}
            onBackgroundPresetChange={handleBackgroundPresetChange}
            onBackgroundImageChange={handleBackgroundImageChange}
            onBackgroundImageClear={handleBackgroundImageClear}
          />
        )}

        {activeTab === 'dashboard' && activeHousehold && (
          <DashboardView
            accounts={accounts}
            transactions={transactions}
            homeItems={homeItems}
            householdName={activeHousehold.name}
            activeTheme={activeTheme}
            onOpenAccounts={() => setActiveTab('accounts')}
            onOpenLedger={() => setActiveTab('ledger')}
            onOpenHomeTab={(tab) => { setHomeManagementInitialTab(tab); setActiveTab('home'); }}
            viewMode={workspaceViewMode}
            dashboardWidgetOrder={dashboardWidgetOrder}
            visibleDashboardWidgetIds={visibleDashboardWidgetIds}
            dashboardWidgetSizes={dashboardWidgetSizes}
          />
        )}

        {activeTab === 'documents' && activeHousehold && (
          <DocumentCenterView
            household={activeHousehold}
            currentUser={currentUser}
            activeTheme={activeTheme}
            canRead={Boolean(currentMembership)}
            canWrite={canPerformFinance}
            accounts={accounts}
            transactions={transactions}
            onImportTransactions={handleImportTransactions}
          />
        )}

        {activeTab === 'home' && activeHousehold && (
          <HomeManagementView
            household={activeHousehold}
            currentUser={currentUser}
            activeTheme={activeTheme}
            canRead={Boolean(currentMembership)}
            canWrite={canPerformFood}
            accounts={accounts}
            transactions={transactions}
            persons={persons}
            onOpenLedger={() => setActiveTab('ledger')}
            initialTab={homeManagementInitialTab}
            onItemsChange={setHomeItems}
          />
        )}

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
        </div>
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
            if (activeHousehold) {
              await reloadHouseholdData(activeHousehold.id);
            } else {
              setMemberships([]);
              setPersons([]);
              setAuditLogs([]);
              setAccounts([]);
              setTransactions([]);
            }
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
          accounts={accounts.filter((a) => a.status === 'ACTIVE' || a.id === editingTransaction?.accountId)}
          activeTheme={activeTheme}
          canEdit={canPerformFinance}
        />
      )}
      </Suspense>
    </div>
  );
}

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity, ArrowLeftRight, ChevronLeft, ChevronRight, ClipboardList,
  FileText, FolderOpen, House, Landmark, LayoutDashboard, Search, Settings,
  UsersRound, WalletCards, Utensils, type LucideIcon,
} from 'lucide-react';

export type WorkspaceTab =
  | 'dashboard' | 'overview' | 'accounts' | 'ledger' | 'members'
  | 'households' | 'audit' | 'documents' | 'home' | 'mortgage' | 'settings';

interface WorkspaceNavigationProps {
  activeTab: WorkspaceTab;
  onTabChange: (tab: WorkspaceTab) => void;
  canReadFinance: boolean;
  canReadDocuments: boolean;
  canReadFood: boolean;
  canReadAdmin: boolean;
  accountCount: number;
  transactionCount: number;
  verifiedTransactionCount: number;
  pendingTransactionCount: number;
  householdCount: number;
  memberAndPersonCount: number;
  auditCount: number;
}

type NavigationItem = {
  id: WorkspaceTab;
  label: string;
  description: string;
  icon: LucideIcon;
  count?: number;
  searchTerms?: string;
};
type NavigationGroup = { id: string; label: string; subtitle: string; items: NavigationItem[] };

export const WorkspaceNavigation: React.FC<WorkspaceNavigationProps> = ({
  activeTab, onTabChange, canReadFinance, canReadDocuments, canReadFood, canReadAdmin,
  accountCount, transactionCount, verifiedTransactionCount, pendingTransactionCount,
  householdCount, memberAndPersonCount, auditCount,
}) => {
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    try { return window.localStorage.getItem('homeos:sidebar-collapsed') === 'true'; }
    catch { return false; }
  });
  const [query, setQuery] = useState('');

  useEffect(() => {
    try { window.localStorage.setItem('homeos:sidebar-collapsed', String(collapsed)); }
    catch { /* Storage can be disabled; the navigation still works for this session. */ }
  }, [collapsed]);

  const groups = useMemo<NavigationGroup[]>(() => {
    const result: NavigationGroup[] = [
      {
        id: 'overview', label: 'מרכז שליטה', subtitle: 'OVERVIEW',
        items: [
          { id: 'dashboard', label: 'לוח בקרה', description: 'תמונת מצב חכמה של הבית', icon: LayoutDashboard },
        ],
      },
    ];
    if (canReadFinance) result.push({
      id: 'finance', label: 'כספים', subtitle: 'FINANCIAL CONTROL',
      items: [
        { id: 'accounts', label: 'חשבונות ונכסים', description: 'יתרות, נכסים והתחייבויות', icon: WalletCards, count: accountCount, searchTerms: 'בנק עוש עו״ש אשראי כרטיס הלוואה משכנתא חסכון חיסכון השקעה יתרה' },
        { id: 'mortgage', label: 'מרכז משכנתאות', description: 'מסלולים, דוחות, ריביות ויתרות', icon: Landmark, searchTerms: 'mortgage משכנתה משכנתא הלוואת דיור מסלולים קרן ריבית החזר דוח סילוקין' },
        { id: 'ledger', label: 'פנקס עסקאות', description: 'תנועות, סיווג ואימות', icon: ArrowLeftRight, count: transactionCount, searchTerms: 'עסקה עסקאות תנועה תנועות הכנסה הוצאה העברה קבלה חיוב זיכוי דף חשבון בנק' },
      ],
    });
    if (canReadDocuments || canReadFood) result.push({
      id: 'operations', label: 'תפעול הבית', subtitle: 'HOME OPERATIONS',
      items: [
        ...(canReadDocuments ? [{ id: 'documents' as const, label: 'מרכז מסמכים', description: 'קליטה, עיון וארכיון', icon: FolderOpen, searchTerms: 'מסמך מסמכים קובץ קבצים חשבונית קבלה תלוש דוח ארכיון' }] : []),
        ...(canReadFood ? [{ id: 'home' as const, label: 'ניהול הבית', description: 'תכנון, מלאי ומשימות', icon: Utensils, searchTerms: 'בית מטבח אוכל מזון מתכון מתכונים קניות רשימה מלאי משימה משימות תכנון ארוחה' }] : []),
      ],
    });
    result.push({
      id: 'system', label: 'ניהול מערכת', subtitle: 'PEOPLE & SYSTEM',
      items: [
        ...(canReadAdmin ? [{ id: 'members' as const, label: 'משפחה והרשאות', description: 'משתמשים, בני בית וגישה', icon: UsersRound, count: memberAndPersonCount, searchTerms: 'משפחה בן בית ילדים משתמש הרשאות גישה תפקיד' }] : []),
        { id: 'households', label: 'משקי בית', description: 'ניהול סביבות הבית', icon: House, count: householdCount, searchTerms: 'בית סביבה משק משפחה בחירה' },
        ...(canReadAdmin ? [{ id: 'audit' as const, label: 'יומן ביקורת', description: 'היסטוריית שינויים', icon: ClipboardList, count: auditCount, searchTerms: 'לוג היסטוריה שינוי פעולות תיעוד audit' }] : []),
        { id: 'settings', label: 'הגדרות אישיות', description: 'עיצוב וסביבת העבודה', icon: Settings },
      ],
    });
    return result;
  }, [
    canReadFinance, canReadDocuments, canReadFood, canReadAdmin,
    accountCount, transactionCount, householdCount, memberAndPersonCount, auditCount,
  ]);

  const filteredGroups = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('he-IL');
    if (!normalized) return groups;
    return groups
      .map(group => ({
        ...group,
        items: group.items.filter(item =>
          item.label.toLocaleLowerCase('he-IL').includes(normalized)
          || item.description.toLocaleLowerCase('he-IL').includes(normalized)
          || (item.searchTerms || '').toLocaleLowerCase('he-IL').includes(normalized),
        ),
      }))
      .filter(group => group.items.length > 0);
  }, [groups, query]);

  return (
    <aside
      className={`homeos-navigation-shell homeos-command-rail homeos-workspace-sidebar ${collapsed ? 'is-collapsed' : ''}`}
      data-collapsed={collapsed}
      aria-label="סביבת העבודה"
    >
      <div className="homeos-sidebar-heading">
        <div className="homeos-sidebar-title-wrap">
          <span className="homeos-sidebar-kicker">HOME OS / WORKSPACE</span>
          <h2>מרחבי העבודה</h2>
          <p>כל מה שקורה בבית, במקום אחד.</p>
        </div>
        <button
          type="button"
          className="homeos-sidebar-collapse"
          aria-label={collapsed ? 'הרחבת תפריט הניווט' : 'צמצום תפריט הניווט'}
          aria-expanded={!collapsed}
          onClick={() => setCollapsed(value => !value)}
          title={collapsed ? 'הרחבת תפריט' : 'צמצום תפריט'}
        >
          {collapsed ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>
      </div>

      {canReadFinance && (
        <div className="homeos-sidebar-integrity" aria-label="מצב נתוני העסקאות">
          <span className="homeos-sidebar-integrity-item is-verified"><i />{verifiedTransactionCount} מאומתות</span>
          <span className="homeos-sidebar-integrity-item is-pending"><i />{pendingTransactionCount} לאימות</span>
        </div>
      )}

      {!collapsed && (
        <label className="homeos-sidebar-search">
          <Search className="h-4 w-4" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="חיפוש אזור במערכת"
            aria-label="חיפוש אזור במערכת"
          />
          <kbd>סינון</kbd>
        </label>
      )}

      <nav aria-label="ניווט ראשי" className="homeos-main-nav">
        {filteredGroups.map(group => (
          <div className="homeos-nav-group" key={group.id}>
            <div className="homeos-nav-section-label">
              <span>{group.label}</span>
              <small>{group.subtitle}</small>
            </div>
            {group.items.map(item => {
              const selected = activeTab === item.id;
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  aria-current={selected ? 'page' : undefined}
                  className="homeos-nav-item"
                  title={collapsed ? item.label : item.description}
                >
                  <span className="homeos-nav-icon"><Icon className="h-4 w-4" /></span>
                  <span className="homeos-nav-copy">
                    <strong>{item.label}</strong>
                    {!collapsed && <small>{item.description}</small>}
                  </span>
                  {typeof item.count === 'number' && !collapsed && (
                    <span className="homeos-nav-count">{item.count.toLocaleString('he-IL')}</span>
                  )}
                  {selected && <span className="homeos-nav-active-marker" aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        ))}
        {filteredGroups.length === 0 && (
          <div className="homeos-nav-empty"><FileText className="h-5 w-5" />לא נמצא אזור מתאים</div>
        )}
      </nav>

      <div className="homeos-sidebar-footer">
        <span className="homeos-sidebar-footer-mark"><Activity className="h-4 w-4" /></span>
        <span><strong>HOME OS</strong><small>HOUSEHOLD INTELLIGENCE</small></span>
      </div>
    </aside>
  );
};

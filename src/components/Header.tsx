import React from 'react';
import { Download, ShieldCheck, Database, History, Users, ChevronDown, Home, CloudOff } from 'lucide-react';
import { Household, User } from '../types.ts';
import { ThemeConfig } from '../lib/themes.ts';

interface HeaderProps {
  household: Household | null;
  currentUser: User | null;
  activeTheme: ThemeConfig;
  canManageSystem: boolean;
  onOpenHouseholds: () => void;
  onOpenAuth: () => void;
  onOpenAudit: () => void;
  onOpenTests: () => void;
  onOpenBackup: () => void;
  onOpenExportHtml: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  household, currentUser, activeTheme, canManageSystem, onOpenHouseholds,
  onOpenAuth, onOpenAudit, onOpenTests, onOpenBackup, onOpenExportHtml,
}) => {
  const controlStyle = {
    backgroundColor: activeTheme.bgCard,
    borderColor: activeTheme.borderSubtle,
    color: activeTheme.textPrimary,
  };

  return (
    <header className="homeos-topbar homeos-executive-topbar" dir="rtl">
      <div className="homeos-topbar-inner homeos-executive-topbar-inner mx-auto flex items-center justify-between gap-4 px-4">
        <div className="homeos-brand-cluster flex min-w-0 items-center gap-3">
          <div className="homeos-brand-mark" aria-hidden="true"><Home className="h-5 w-5" strokeWidth={1.7} /></div>
          <div className="homeos-brand-copy min-w-0">
            <div className="flex items-center gap-2">
              <span className="homeos-brand-wordmark">HOME OS</span>
              <span className="homeos-brand-edition">PRIVATE WORKSPACE</span>
            </div>
            <span className="homeos-brand-caption">מערכת ניהול משק הבית</span>
          </div>
          <span className="homeos-header-divider" aria-hidden="true" />
          <button type="button" onClick={onOpenHouseholds} className="homeos-household-switch homeos-header-household" title="בחירת משק בית">
            <Home className="h-3.5 w-3.5" strokeWidth={1.7} />
            <span className="max-w-44 truncate">{household?.name || 'בחירת משק בית'}</span>
            <ChevronDown className="h-3 w-3 opacity-55" />
          </button>
        </div>

        <div className="homeos-topbar-tools homeos-executive-utilities flex shrink-0 items-center gap-1.5">
          <div className="homeos-sync-state homeos-header-storage" role="status" title="הנתונים נשמרים בדפדפן הנוכחי. סנכרון בין מכשירים עדיין לא הוגדר.">
            <CloudOff aria-hidden="true" />
            <span>אחסון מקומי</span>
          </div>
          {canManageSystem && <>
            <button type="button" onClick={onOpenAudit} className="homeos-toolbar-button homeos-header-icon-button" style={controlStyle} title="יומן ביקורת" aria-label="פתיחת יומן ביקורת"><History className="h-4 w-4" strokeWidth={1.7} /></button>
            <button type="button" onClick={onOpenBackup} className="homeos-toolbar-button homeos-header-icon-button" style={controlStyle} title="גיבוי ושחזור" aria-label="גיבוי ושחזור"><Database className="h-4 w-4" strokeWidth={1.7} /></button>
            <button type="button" onClick={onOpenTests} className="homeos-toolbar-button homeos-header-icon-button" style={controlStyle} title="בדיקות מערכת" aria-label="בדיקות מערכת"><ShieldCheck className="h-4 w-4" strokeWidth={1.7} /></button>
            <button type="button" onClick={onOpenExportHtml} className="homeos-toolbar-button homeos-header-icon-button" style={controlStyle} title="ייצוא מערכת" aria-label="ייצוא מערכת"><Download className="h-4 w-4" strokeWidth={1.7} /></button>
          </>}
          <button type="button" onClick={onOpenAuth} className="homeos-user-button homeos-header-user" style={controlStyle} title={currentUser?.fullName || 'משתמש'} aria-label="חשבון משתמש">
            {currentUser?.fullName?.trim()?.charAt(0) || <Users className="h-4 w-4" strokeWidth={1.7} />}
          </button>
        </div>
      </div>
    </header>
  );
};

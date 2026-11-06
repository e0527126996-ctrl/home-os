import React from 'react';
import { Download, ShieldCheck, Database, Palette, Users, ChevronDown, Home, Sparkles, Cloud, Settings2 } from 'lucide-react';
import { Household, User } from '../types.ts';
import { MODERN_EDITORIAL_THEMES, ThemeConfig } from '../lib/themes.ts';

interface HeaderProps {
  household: Household | null;
  currentUser: User | null;
  activeTheme: ThemeConfig;
  onThemeSelect: (themeId: string) => void;
  onOpenHouseholds: () => void;
  onOpenAuth: () => void;
  onOpenAudit: () => void;
  onOpenTests: () => void;
  onOpenBackup: () => void;
  onOpenExportHtml: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  household, currentUser, activeTheme, onThemeSelect, onOpenHouseholds,
  onOpenAuth, onOpenTests, onOpenBackup, onOpenExportHtml,
}) => {
  const controlStyle = { backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle, color: activeTheme.textPrimary };
  return (
    <header className="homeos-topbar" dir="rtl">
      <div className="mx-auto flex max-w-[1540px] items-center justify-between gap-4 px-4 py-3 sm:px-7 lg:px-10">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <div className="homeos-brand-mark"><Home className="h-5 w-5" /></div>
          <div className="min-w-0"><div className="flex items-center gap-2"><span className="text-xl font-extrabold tracking-[-.06em]">HOME OS</span><span className="hidden rounded-full border border-[#547D70]/20 bg-[#547D70]/[.07] px-2 py-0.5 text-[9px] font-bold tracking-wider text-[#547D70] sm:inline-flex">PRIVATE DESK</span></div><div className="mt-0.5 text-[9px] font-semibold tracking-[.22em]" style={{ color: activeTheme.textSecondary }}>HOUSEHOLD OPERATING SYSTEM</div></div>
          {household && <button onClick={onOpenHouseholds} className="homeos-household-switch"><span className="homeos-live-dot" /><span className="max-w-36 truncate">{household.name}</span><ChevronDown className="h-3.5 w-3.5 opacity-50" /></button>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="group relative">
            <button className="homeos-toolbar-button" style={controlStyle}><Palette className="h-4 w-4 text-[#B98B58]" /><span className="hidden lg:inline">עיצוב</span><ChevronDown className="h-3 w-3 opacity-50" /></button>
            <div className="absolute left-0 top-full z-50 mt-2 hidden w-64 rounded-2xl border p-2 shadow-2xl group-hover:block focus-within:block" style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}>
              {MODERN_EDITORIAL_THEMES.map(theme => <button key={theme.id} onClick={() => onThemeSelect(theme.id)} className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-right text-xs transition hover:bg-black/5 dark:hover:bg-white/5"><span className={activeTheme.id === theme.id ? 'font-bold' : ''}>{theme.nameHe}</span><span className="h-3.5 w-3.5 rounded-full ring-2 ring-black/5" style={{ backgroundColor: theme.accent }} /></button>)}
            </div>
          </div>
          <button onClick={onOpenBackup} className="homeos-toolbar-button" style={controlStyle} title="גיבוי ושחזור"><Database className="h-4 w-4" /><span className="hidden lg:inline">גיבוי</span></button>
          <button onClick={onOpenTests} className="homeos-toolbar-button" style={controlStyle} title="בדיקות מערכת"><ShieldCheck className="h-4 w-4" /><span className="hidden xl:inline">בדיקות</span></button>
          <button onClick={onOpenExportHtml} className="homeos-export-button"><Download className="h-4 w-4" /><span className="hidden sm:inline">ייצוא מערכת</span></button>
          <button onClick={onOpenAuth} className="homeos-user-button" style={controlStyle} title={currentUser?.fullName || 'משתמש'}>{currentUser?.fullName?.charAt(0) || <Users className="h-4 w-4" />}</button>
        </div>
      </div>
      {household && <div className="border-t px-4 py-2 md:hidden" style={{ borderColor: activeTheme.borderSubtle }}><button onClick={onOpenHouseholds} className="flex items-center gap-2 text-xs font-semibold" style={{ color: activeTheme.textSecondary }}><Home className="h-3.5 w-3.5" /> {household.name} · החלפת משק בית</button></div>}
    </header>
  );
};

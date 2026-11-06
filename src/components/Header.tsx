import React from 'react';
import { Download, ShieldCheck, Database, Palette, Users, ChevronDown, Home } from 'lucide-react';
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
  const control = 'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-semibold transition-all hover:-translate-y-0.5 hover:shadow-sm';
  const controlStyle = { backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle, color: activeTheme.textPrimary };
  return (
    <header className="sticky top-0 z-40 border-b backdrop-blur-xl" style={{ backgroundColor: activeTheme.bgCanvas + 'F2', borderColor: activeTheme.borderSubtle, color: activeTheme.textPrimary }}>
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-4 px-4 py-3 sm:px-7 lg:px-10">
        <div className="flex min-w-0 items-center gap-3 sm:gap-5">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-lg" style={{ background: 'linear-gradient(145deg, #183A30, #547A61)' }}><Home className="h-5 w-5" /></div>
          <div className="min-w-0">
            <div className="font-serif text-2xl font-bold leading-none tracking-tight">HOME OS</div>
            <div className="mt-1 text-[10px] font-semibold tracking-[.2em]" style={{ color: activeTheme.textSecondary }}>HOUSEHOLD FINANCE</div>
          </div>
          {household && <button onClick={onOpenHouseholds} className="hidden items-center gap-2 rounded-full border px-3.5 py-2 text-xs font-semibold transition hover:shadow-sm md:flex" style={controlStyle}><span className="h-2 w-2 rounded-full" style={{ backgroundColor: activeTheme.accent }} />{household.name}<ChevronDown className="h-3.5 w-3.5 opacity-60" /></button>}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <div className="group relative hidden sm:block">
            <button className={control} style={controlStyle}><Palette className="h-4 w-4" style={{ color: activeTheme.accent }} /><span className="hidden lg:inline">{activeTheme.nameHe.split(' ')[0]}</span><ChevronDown className="h-3 w-3 opacity-50" /></button>
            <div className="absolute left-0 top-full z-50 mt-2 hidden w-64 rounded-2xl border p-2 shadow-xl group-hover:block focus-within:block" style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}>
              {MODERN_EDITORIAL_THEMES.map(theme => <button key={theme.id} onClick={() => onThemeSelect(theme.id)} className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-right text-xs hover:bg-black/5 dark:hover:bg-white/5"><span className={activeTheme.id === theme.id ? 'font-bold' : ''}>{theme.nameHe}</span><span className="h-3 w-3 rounded-full" style={{ backgroundColor: theme.accent }} /></button>)}
            </div>
          </div>
          <button onClick={onOpenBackup} className={control} style={controlStyle} title="גיבוי ושחזור"><Database className="h-4 w-4" /><span className="hidden lg:inline">גיבוי</span></button>
          <button onClick={onOpenTests} className={control} style={controlStyle} title="בדיקות מערכת"><ShieldCheck className="h-4 w-4" /><span className="hidden xl:inline">בדיקות</span></button>
          <button onClick={onOpenExportHtml} className="inline-flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-xs font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg" style={{ backgroundColor: activeTheme.accent }}><Download className="h-4 w-4" /><span className="hidden sm:inline">ייצוא מערכת</span></button>
          <button onClick={onOpenAuth} className="flex h-10 w-10 items-center justify-center rounded-full border text-sm font-bold shadow-sm transition hover:shadow-md" style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle, color: activeTheme.textPrimary }} title={currentUser?.fullName || 'משתמש'}>{currentUser?.fullName?.charAt(0) || <Users className="h-4 w-4" />}</button>
        </div>
      </div>
      {household && <div className="border-t px-4 py-2 md:hidden" style={{ borderColor: activeTheme.borderSubtle }}><button onClick={onOpenHouseholds} className="text-xs font-semibold" style={{ color: activeTheme.textSecondary }}>משק בית: {household.name} · החלפה</button></div>}
    </header>
  );
};

import React from 'react';
import { Download, ShieldCheck, Database, Palette, Users, RefreshCw } from 'lucide-react';
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
  household,
  currentUser,
  activeTheme,
  onThemeSelect,
  onOpenHouseholds,
  onOpenAuth,
  onOpenAudit,
  onOpenTests,
  onOpenBackup,
  onOpenExportHtml,
}) => {
  return (
    <header
      className="border-b transition-colors duration-200 sticky top-0 z-30"
      style={{
        backgroundColor: activeTheme.bgSurface,
        borderColor: activeTheme.borderSubtle,
        color: activeTheme.textPrimary,
      }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4">
        {/* Brand & Active Household */}
        <div className="flex items-center gap-6">
          <div className="flex items-baseline gap-2">
            <span className="font-serif text-2xl font-semibold tracking-tight">HOME OS</span>
            <span
              className="text-xs uppercase tracking-widest font-mono hidden sm:inline-block"
              style={{ color: activeTheme.textSecondary }}
            >
              PHASE 2 · SUB-PHASE A · ACCOUNTS
            </span>
          </div>

          {household && (
            <button
              onClick={onOpenHouseholds}
              className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium border transition-all hover:opacity-90"
              style={{
                backgroundColor: activeTheme.bgCard,
                borderColor: activeTheme.borderSubtle,
                color: activeTheme.textPrimary,
              }}
              title="החלפת משק בית פעיל"
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: activeTheme.accent }} />
              <span className="font-serif font-medium">{household.name}</span>
              <span className="text-[10px] opacity-70">({household.currency})</span>
            </button>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Automated Tests Button */}
          <button
            onClick={onOpenTests}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-colors"
            style={{
              backgroundColor: activeTheme.bgCard,
              borderColor: activeTheme.borderSubtle,
              color: activeTheme.textPrimary,
            }}
            title="הרצת בדיקות אוטומטיות (Phase 0+1)"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span className="hidden md:inline">בדיקות אוטומטיות</span>
          </button>

          {/* Backup / Restore Button */}
          <button
            onClick={onOpenBackup}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-colors"
            style={{
              backgroundColor: activeTheme.bgCard,
              borderColor: activeTheme.borderSubtle,
              color: activeTheme.textPrimary,
            }}
            title="גיבוי ושחזור נתונים (JSON)"
          >
            <Database className="w-3.5 h-3.5 opacity-70" />
            <span className="hidden md:inline">גיבוי / שחזור</span>
          </button>

          {/* Theme Selector Dropdown */}
          <div className="relative group">
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded border transition-colors"
              style={{
                backgroundColor: activeTheme.bgCard,
                borderColor: activeTheme.borderSubtle,
                color: activeTheme.textPrimary,
              }}
              title="ערכות נושא Modern Editorial (12 ערכות)"
            >
              <Palette className="w-3.5 h-3.5" style={{ color: activeTheme.accent }} />
              <span className="hidden lg:inline">{activeTheme.nameHe.split(' ')[0]}</span>
            </button>

            <div
              className="absolute left-0 mt-1 w-64 rounded shadow-lg border p-1 hidden group-hover:block group-focus-within:block z-50 text-xs"
              style={{
                backgroundColor: activeTheme.bgCard,
                borderColor: activeTheme.borderSubtle,
                color: activeTheme.textPrimary,
              }}
            >
              <div className="px-2 py-1.5 text-[10px] font-mono uppercase tracking-wider opacity-60 border-b border-inherit">
                בחר ערכת נושא (12 Themes)
              </div>
              <div className="max-h-72 overflow-y-auto py-1">
                {MODERN_EDITORIAL_THEMES.map((theme) => (
                  <button
                    key={theme.id}
                    onClick={() => onThemeSelect(theme.id)}
                    className="w-full text-right px-2.5 py-1.5 rounded flex items-center justify-between hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                  >
                    <span className={activeTheme.id === theme.id ? 'font-bold' : ''}>{theme.nameHe}</span>
                    <span
                      className="w-3 h-3 rounded-full border border-black/10 shrink-0 mr-2"
                      style={{ backgroundColor: theme.accent }}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Download Standalone HTML Button */}
          <button
            onClick={onOpenExportHtml}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded text-white shadow-sm transition-all hover:opacity-90"
            style={{ backgroundColor: activeTheme.accent }}
            title="הורדת קובץ HTML מלא להפעלה אופליין במחשב"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="font-semibold">HOME-OS.html</span>
          </button>

          {/* User Profile / Auth Switcher */}
          <button
            onClick={onOpenAuth}
            className="flex items-center gap-2 pr-2 pl-3 py-1 rounded border transition-colors mr-1"
            style={{
              backgroundColor: activeTheme.bgCard,
              borderColor: activeTheme.borderSubtle,
              color: activeTheme.textPrimary,
            }}
            title="משתמש מחובר / החלפת משתמש"
          >
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] text-white font-bold"
              style={{ backgroundColor: currentUser?.avatarColor || activeTheme.accent }}
            >
              {currentUser?.fullName ? currentUser.fullName.charAt(0) : '?'}
            </div>
            <span className="text-xs font-medium hidden sm:inline max-w-[120px] truncate">
              {currentUser?.fullName || 'כניסה'}
            </span>
          </button>
        </div>
      </div>
    </header>
  );
};

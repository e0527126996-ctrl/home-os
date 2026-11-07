import React from 'react';
import { Check, Palette, Sparkles } from 'lucide-react';
import type { ThemeConfig } from '../lib/themes.ts';

interface SettingsViewProps {
  themes: ThemeConfig[];
  activeTheme: ThemeConfig;
  onThemeSelect: (themeId: string) => void | Promise<void>;
  density: 'compact' | 'balanced' | 'spacious';
  onDensityChange: (density: 'compact' | 'balanced' | 'spacious') => void | Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({ themes, activeTheme, onThemeSelect, density, onDensityChange }) => {
  return (
    <section className="homeos-settings space-y-7" dir="rtl">
      <header className="homeos-settings-hero">
        <div className="flex items-center gap-3">
          <div className="homeos-settings-icon"><Palette className="h-5 w-5" /></div>
          <div>
            <div className="homeos-section-kicker">PERSONAL WORKSPACE</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">הגדרות אישיות</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>התאם את סביבת העבודה למראה, לאווירה ולנוחות שלך.</p>
          </div>
        </div>
        <div className="homeos-settings-current">
          <Sparkles className="h-4 w-4" />
          <span>העיצוב הפעיל: <strong>{activeTheme.nameHe}</strong></span>
        </div>
      </header>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="homeos-section-kicker">DESIGN COLLECTION · {themes.length} STYLES</div>
          <h2 className="mt-1 text-lg font-semibold">בחר את שפת העיצוב שלך</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>הבחירה נשמרת במכשיר ותישאר גם בכניסה הבאה.</p>
        </div>
        <span className="homeos-settings-count">{themes.length} ערכות עיצוב</span>
      </div>

      <div className="homeos-theme-grid">
        {themes.map((theme) => {
          const selected = activeTheme.id === theme.id;
          return (
            <button
              key={theme.id}
              type="button"
              aria-pressed={selected}
              onClick={() => void onThemeSelect(theme.id)}
              className={`homeos-theme-option ${selected ? 'is-selected' : ''}`}
              style={{
                '--preview-canvas': theme.bgCanvas,
                '--preview-surface': theme.bgSurface,
                '--preview-card': theme.bgCard,
                '--preview-border': theme.borderSubtle,
                '--preview-text': theme.textPrimary,
                '--preview-muted': theme.textSecondary,
                '--preview-accent': theme.accent,
              } as React.CSSProperties}
            >
              <span className="homeos-theme-preview" aria-hidden="true">
                <span className="homeos-theme-preview-sidebar" />
                <span className="homeos-theme-preview-main">
                  <span className="homeos-theme-preview-top" />
                  <span className="homeos-theme-preview-panel">
                    <i /><i /><i />
                  </span>
                  <span className="homeos-theme-preview-chart"><i /><i /><i /><i /><i /></span>
                </span>
              </span>
              <span className="homeos-theme-option-copy">
                <span className="min-w-0">
                  <strong>{theme.nameHe}</strong>
                  <small>{theme.nameEn}</small>
                </span>
                <span className="homeos-theme-check" aria-hidden="true">{selected && <Check className="h-4 w-4" />}</span>
              </span>
              <span className="homeos-theme-description">{theme.description}</span>
            </button>
          );
        })}
      </div>
      <section className="homeos-density-section" aria-labelledby="homeos-density-heading">
        <div>
          <div className="homeos-section-kicker">WORKSPACE COMFORT</div>
          <h2 id="homeos-density-heading" className="mt-1 text-lg font-semibold">צפיפות סביבת העבודה</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>קבע כמה מרווח יהיה בין אזורי המידע והפעולות במסכים.</p>
        </div>
        <div className="homeos-density-options" role="group" aria-label="צפיפות סביבת העבודה">
          {([
            { id: 'compact', label: 'קומפקטי', detail: 'יותר מידע במסך' },
            { id: 'balanced', label: 'מאוזן', detail: 'שילוב של מידע ומרווח' },
            { id: 'spacious', label: 'מרווח', detail: 'יותר אוויר ונוחות' },
          ] as const).map((option) => (
            <button key={option.id} type="button" aria-pressed={density === option.id}
              className={`homeos-density-option ${density === option.id ? 'is-selected' : ''}`}
              onClick={() => void onDensityChange(option.id)}>
              <span className="homeos-density-preview" aria-hidden="true"><i /><i /><i /></span>
              <strong>{option.label}</strong><small>{option.detail}</small>
            </button>
          ))}
        </div>
      </section>
      <p className="text-xs leading-6" style={{ color: 'var(--text-secondary)' }}>
        החלפת ערכת העיצוב משנה את שכבת התצוגה בלבד. הנתונים, החשבונות, העסקאות וההרשאות אינם משתנים.
      </p>
    </section>
  );
};

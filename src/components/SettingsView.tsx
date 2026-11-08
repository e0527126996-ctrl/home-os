import React from 'react';
import { ArrowDown, ArrowUp, Check, ImagePlus, LayoutGrid, Palette, Sparkles, Trash2 } from 'lucide-react';
import type { ThemeConfig } from '../lib/themes.ts';
import type { WorkspaceViewMode, DashboardWidgetSize, WorkspaceBackgroundPresetId } from '../lib/workspace.ts';
import { BACKGROUND_PRESETS, DASHBOARD_WIDGETS } from '../lib/workspace.ts';

interface SettingsViewProps {
  themes: ThemeConfig[];
  activeTheme: ThemeConfig;
  onThemeSelect: (themeId: string) => void | Promise<void>;
  density: 'compact' | 'balanced' | 'spacious';
  onDensityChange: (density: 'compact' | 'balanced' | 'spacious') => void | Promise<void>;
  workspaceViewMode: WorkspaceViewMode;
  onWorkspaceViewModeChange: (mode: WorkspaceViewMode) => void | Promise<void>;
  dashboardWidgetOrder: string[];
  visibleDashboardWidgetIds: string[];
  onDashboardWidgetToggle: (widgetId: string, visible: boolean) => void | Promise<void>;
  onDashboardWidgetMove: (widgetId: string, direction: 'up' | 'down') => void | Promise<void>;
  dashboardWidgetSizes: Record<string, DashboardWidgetSize>;
  onDashboardWidgetSizeChange: (widgetId: string, size: DashboardWidgetSize) => void | Promise<void>;
  backgroundImage: string | null;
  backgroundPresetId: WorkspaceBackgroundPresetId;
  onBackgroundPresetChange: (presetId: WorkspaceBackgroundPresetId) => void | Promise<void>;
  onBackgroundImageChange: (file: File | null) => void | Promise<void>;
  onBackgroundImageClear: () => void | Promise<void>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  themes, activeTheme, onThemeSelect, density, onDensityChange,
  workspaceViewMode, onWorkspaceViewModeChange, dashboardWidgetOrder,
  visibleDashboardWidgetIds, onDashboardWidgetToggle, onDashboardWidgetMove,
  dashboardWidgetSizes, onDashboardWidgetSizeChange,
  backgroundImage, backgroundPresetId, onBackgroundPresetChange, onBackgroundImageChange, onBackgroundImageClear,
}) => {
  const orderedWidgets = [...DASHBOARD_WIDGETS].sort(
    (a, b) => dashboardWidgetOrder.indexOf(a.id) - dashboardWidgetOrder.indexOf(b.id),
  );

  return (
    <section className="homeos-settings homeos-workspace-page homeos-atlas-settings space-y-7" dir="rtl">
      <header className="homeos-settings-hero">
        <div className="flex items-center gap-3">
          <div className="homeos-settings-icon"><Palette className="h-5 w-5" /></div>
          <div>
            <div className="homeos-section-kicker">PERSONAL WORKSPACE</div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">הגדרות אישיות</h1>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>שליטה במראה, בצורת העבודה ובתוכן שמופיע בלוח הבקרה.</p>
          </div>
        </div>
        <div className="homeos-settings-current">
          <Sparkles className="h-4 w-4" />
          <span>העיצוב הפעיל: <strong>{activeTheme.nameHe}</strong></span>
        </div>
      </header>

      <section className="homeos-settings-section">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="homeos-section-kicker">DESIGN COLLECTION · {themes.length} STYLES</div>
            <h2 className="mt-1 text-lg font-semibold">שפת העיצוב</h2>
            <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>החלפת ערכה משנה את שכבת התצוגה בלבד.</p>
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
                    <span className="homeos-theme-preview-panel"><i /><i /><i /></span>
                    <span className="homeos-theme-preview-chart"><i /><i /><i /><i /><i /></span>
                  </span>
                </span>
                <span className="homeos-theme-option-copy">
                  <span className="min-w-0"><strong>{theme.nameHe}</strong><small>{theme.nameEn}</small></span>
                  <span className="homeos-theme-check" aria-hidden="true">{selected && <Check className="h-4 w-4" />}</span>
                </span>
                <span className="homeos-theme-description">{theme.description}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="homeos-settings-section">
        <div>
          <div className="homeos-section-kicker">WORKSPACE MODE</div>
          <h2 className="mt-1 text-lg font-semibold">מצב העבודה</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>בחר את סוג המידע שיקבל את מרכז הבמה בלוח הבקרה.</p>
        </div>
        <div className="homeos-view-mode-grid">
          {([
            { id: 'executive', label: 'Executive', title: 'מנהלים', detail: 'תמונת מצב מהירה, הון, מדדים ותובנות' },
            { id: 'productivity', label: 'Productivity', title: 'עבודה שוטפת', detail: 'עסקאות אחרונות, משימות ומעקב יום-יומי' },
            { id: 'analytics', label: 'Analytics', title: 'אנליטיקה', detail: 'מגמות, תחזיות, פילוחים ובקרת איכות' },
          ] as const).map((mode) => (
            <button key={mode.id} type="button" aria-pressed={workspaceViewMode === mode.id}
              className={`homeos-view-mode-option ${workspaceViewMode === mode.id ? 'is-selected' : ''}`}
              onClick={() => void onWorkspaceViewModeChange(mode.id)}>
              <span className="homeos-view-mode-label">{mode.label}</span>
              <strong>{mode.title}</strong>
              <small>{mode.detail}</small>
              {workspaceViewMode === mode.id && <span className="homeos-view-mode-check"><Check className="h-4 w-4" /> פעיל</span>}
            </button>
          ))}
        </div>
      </section>

      <section className="homeos-settings-section">
        <div>
          <div className="homeos-section-kicker">DASHBOARD BUILDER</div>
          <h2 className="mt-1 text-lg font-semibold">הרכב לוח הבקרה</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>הסתר או הצג אזורים ושנה את סדר הופעתם. השינוי משפיע על לוח הבקרה בלבד.</p>
        </div>
        <div className="homeos-widget-editor">
          {orderedWidgets.map((widget, index) => {
            const visible = visibleDashboardWidgetIds.includes(widget.id);
            return (
              <div className="homeos-widget-editor-row" key={widget.id}>
                <label className="homeos-widget-toggle">
                  <input type="checkbox" checked={visible} onChange={(event) => void onDashboardWidgetToggle(widget.id, event.target.checked)} />
                  <span className="homeos-widget-toggle-mark" />
                  <span className="min-w-0"><strong>{widget.title}</strong><small>{widget.description}</small></span>
                </label>
                <div className="homeos-widget-order">
                  <select aria-label={`גודל אזור ${widget.title}`} className="homeos-widget-size-select"
                    value={dashboardWidgetSizes[widget.id] || 'standard'}
                    onChange={(event) => void onDashboardWidgetSizeChange(widget.id, event.target.value as DashboardWidgetSize)}>
                    <option value="compact">קומפקטי</option>
                    <option value="standard">רגיל</option>
                    <option value="expanded">מורחב</option>
                  </select>
                  <span>{index + 1}</span>
                  <button type="button" title="העבר למעלה" aria-label={`העבר את ${widget.title} למעלה`} disabled={index === 0}
                    onClick={() => void onDashboardWidgetMove(widget.id, 'up')}><ArrowUp className="h-4 w-4" /></button>
                  <button type="button" title="העבר למטה" aria-label={`העבר את ${widget.title} למטה`} disabled={index === orderedWidgets.length - 1}
                    onClick={() => void onDashboardWidgetMove(widget.id, 'down')}><ArrowDown className="h-4 w-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="homeos-settings-section">
        <div>
          <div className="homeos-section-kicker">PERSONAL BACKDROP</div>
          <h2 className="mt-1 text-lg font-semibold">רקעים לסביבת העבודה</h2>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>בחר רקע מוכן מהגלריה או העלה תמונה אישית משלך.</p>
        </div>
        <div className="homeos-background-preset-grid">
          {BACKGROUND_PRESETS.map((preset) => {
            const selected = backgroundPresetId === preset.id && !backgroundImage;
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={selected}
                onClick={() => void onBackgroundPresetChange(preset.id)}
                className={`homeos-background-preset ${selected ? 'is-selected' : ''}`}
                style={{ backgroundImage: preset.background }}
              >
                <span className="homeos-background-preset-label">{preset.nameHe}</span>
                <small className="homeos-background-preset-description">{preset.description}</small>
                {selected && <span className="homeos-background-preset-check"><Check className="h-4 w-4" /></span>}
              </button>
            );
          })}
        </div>
        <div className="homeos-background-editor">
          {backgroundImage ? <div className="homeos-background-preview" style={{ backgroundImage: `url("${backgroundImage}")` }}><span>תמונת רקע פעילה</span></div> : <div className="homeos-background-empty"><ImagePlus className="h-6 w-6" /><span>לא נבחרה תמונת רקע</span></div>}
          <div className="flex flex-wrap gap-2">
            <label className="homeos-secondary-action cursor-pointer">
              <ImagePlus className="h-4 w-4" /> בחירת תמונה
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => { const file = event.target.files?.[0] || null; void onBackgroundImageChange(file); event.currentTarget.value = ''; }} />
            </label>
            {backgroundImage && <button type="button" className="homeos-secondary-action" onClick={() => void onBackgroundImageClear()}><Trash2 className="h-4 w-4" /> הסרת תמונה</button>}
          </div>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>קובצי JPG, PNG או WebP עד 3MB. תמונה אישית תחליף זמנית את הרקע המוכן; הסרתה תחזיר את הרקע שבחרת. הקובץ נשמר מקומית במכשיר.</p>
        </div>
      </section>

      <section className="homeos-settings-section">
        <div>
          <div className="homeos-section-kicker">WORKSPACE COMFORT</div>
          <h2 className="mt-1 text-lg font-semibold">צפיפות סביבת העבודה</h2>
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

      <p className="homeos-settings-footnote">העדפות התצוגה נשמרות במכשיר. החלפת העיצוב או סידור לוח הבקרה אינם משנים נתונים, חשבונות או עסקאות.</p>
    </section>
  );
};

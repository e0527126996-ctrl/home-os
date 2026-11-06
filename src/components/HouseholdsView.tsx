import React, { useState } from 'react';
import { Home, Plus, Check, Settings, Shield, UserCheck } from 'lucide-react';
import { Household, User } from '../types.ts';
import { ThemeConfig } from '../lib/themes.ts';

interface HouseholdsViewProps {
  households: Household[];
  activeHousehold: Household | null;
  currentUser: User | null;
  activeTheme: ThemeConfig;
  onSelectHousehold: (householdId: string) => void;
  onCreateHousehold: (name: string, currency: string) => Promise<void>;
  onUpdateSettings: (settings: Household['settings']) => Promise<void>;
  onClose?: () => void;
}

export const HouseholdsView: React.FC<HouseholdsViewProps> = ({
  households,
  activeHousehold,
  currentUser,
  activeTheme,
  onSelectHousehold,
  onCreateHousehold,
  onUpdateSettings,
  onClose,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [newHhdName, setNewHhdName] = useState('');
  const [newHhdCurrency, setNewHhdCurrency] = useState('₪');
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newHhdName.trim()) {
      setErrorMsg('נא להזין שם עבור משק הבית');
      return;
    }
    setErrorMsg('');
    setIsSubmitting(true);
    try {
      await onCreateHousehold(newHhdName.trim(), newHhdCurrency);
      setNewHhdName('');
      setIsCreating(false);
    } catch (err: any) {
      setErrorMsg(err.message || 'שגיאה ביצירת משק הבית');
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentSettings = activeHousehold?.settings || {
    theme: activeTheme.id,
    density: 'spacious',
    viewMode: 'executive',
  };

  return (
    <div className="space-y-6">
      {/* Header section */}
      <div className="flex items-center justify-between border-b pb-4" style={{ borderColor: activeTheme.borderSubtle }}>
        <div>
          <h2 className="font-serif text-xl font-semibold">משקי בית והגדרות סביבה</h2>
          <p className="text-xs mt-1" style={{ color: activeTheme.textSecondary }}>
            ניהול משקי הבית המקומיים, הגדרות תצוגה והפרדה מוחלטת של הנתונים
          </p>
        </div>
        <button
          onClick={() => setIsCreating(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-white transition-opacity hover:opacity-90"
          style={{ backgroundColor: activeTheme.accent }}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>משק בית חדש</span>
        </button>
      </div>

      {/* New Household Form */}
      {isCreating && (
        <form
          onSubmit={handleCreate}
          className="p-4 rounded-lg border space-y-3"
          style={{ backgroundColor: activeTheme.bgSurface, borderColor: activeTheme.borderSubtle }}
        >
          <div className="text-xs font-semibold uppercase tracking-wider">יצירת משק בית חדש</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-[11px] mb-1 font-medium">שם משק הבית</label>
              <input
                type="text"
                placeholder="למשל: משפחת כהן, דירת שותפים..."
                value={newHhdName}
                onChange={(e) => setNewHhdName(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded border focus:outline-none"
                style={{
                  backgroundColor: activeTheme.bgCard,
                  borderColor: activeTheme.borderSubtle,
                  color: activeTheme.textPrimary,
                }}
                required
              />
            </div>
            <div>
              <label className="block text-[11px] mb-1 font-medium">מטבע מוביל</label>
              <select
                value={newHhdCurrency}
                onChange={(e) => setNewHhdCurrency(e.target.value)}
                className="w-full px-3 py-1.5 text-xs rounded border focus:outline-none"
                style={{
                  backgroundColor: activeTheme.bgCard,
                  borderColor: activeTheme.borderSubtle,
                  color: activeTheme.textPrimary,
                }}
              >
                <option value="₪">שקל ישראלי (₪)</option>
                <option value="$">דולר ארה"ב ($)</option>
                <option value="€">אירו (€)</option>
              </select>
            </div>
          </div>

          {errorMsg && <p className="text-xs text-rose-600 font-medium">{errorMsg}</p>}

          <div className="flex items-center gap-2 pt-1 justify-end">
            <button
              type="button"
              onClick={() => setIsCreating(false)}
              className="px-3 py-1 text-xs rounded border"
              style={{ borderColor: activeTheme.borderSubtle }}
            >
              ביטול
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-1 text-xs font-medium rounded text-white"
              style={{ backgroundColor: activeTheme.accent }}
            >
              {isSubmitting ? 'שומר...' : 'צור משק בית'}
            </button>
          </div>
        </form>
      )}

      {/* Household Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {households.map((h) => {
          const isActive = activeHousehold?.id === h.id;
          return (
            <div
              key={h.id}
              onClick={() => onSelectHousehold(h.id)}
              className={`p-4 rounded-lg border transition-all cursor-pointer relative ${
                isActive ? 'ring-1' : 'hover:border-stone-400'
              }`}
              style={{
                backgroundColor: activeTheme.bgCard,
                borderColor: isActive ? activeTheme.accent : activeTheme.borderSubtle,
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.05)' : undefined,
              }}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <div
                    className="w-8 h-8 rounded flex items-center justify-center font-serif text-sm font-bold"
                    style={{
                      backgroundColor: isActive ? activeTheme.accentMuted : activeTheme.bgSurface,
                      color: isActive ? activeTheme.accent : activeTheme.textPrimary,
                    }}
                  >
                    <Home className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-serif text-base font-semibold">{h.name}</h3>
                    <p className="text-[11px]" style={{ color: activeTheme.textSecondary }}>
                      מטבע: {h.currency} · נוצר: {new Date(h.createdAt).toLocaleDateString('he-IL')}
                    </p>
                  </div>
                </div>

                {isActive && (
                  <span
                    className="flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded"
                    style={{ backgroundColor: activeTheme.accentMuted, color: activeTheme.accent }}
                  >
                    <Check className="w-3 h-3" />
                    <span>פעיל</span>
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Active Household Display Settings */}
      {activeHousehold && (
        <div
          className="p-5 rounded-lg border space-y-4"
          style={{ backgroundColor: activeTheme.bgSurface, borderColor: activeTheme.borderSubtle }}
        >
          <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: activeTheme.borderSubtle }}>
            <Settings className="w-4 h-4" style={{ color: activeTheme.accent }} />
            <h3 className="font-serif text-sm font-semibold">הגדרות תצוגה עריכתיות עבור "{activeHousehold.name}"</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            {/* View Mode Selector */}
            <div>
              <label className="block text-[11px] mb-1 font-medium" style={{ color: activeTheme.textSecondary }}>
                מצב תצוגה מרכזי
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 rounded border" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgCard }}>
                {(['executive', 'productivity', 'analytics'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() =>
                      onUpdateSettings({
                        ...currentSettings,
                        viewMode: mode,
                      })
                    }
                    className={`py-1 text-[11px] rounded font-medium transition-colors ${
                      currentSettings.viewMode === mode ? 'text-white' : 'hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                    style={{
                      backgroundColor: currentSettings.viewMode === mode ? activeTheme.accent : 'transparent',
                    }}
                  >
                    {mode === 'executive' ? 'Executive' : mode === 'productivity' ? 'Productivity' : 'Analytics'}
                  </button>
                ))}
              </div>
            </div>

            {/* Density Selector */}
            <div>
              <label className="block text-[11px] mb-1 font-medium" style={{ color: activeTheme.textSecondary }}>
                צפיפות מרווחים (Density)
              </label>
              <div className="grid grid-cols-3 gap-1 p-1 rounded border" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgCard }}>
                {(['compact', 'balanced', 'spacious'] as const).map((density) => (
                  <button
                    key={density}
                    type="button"
                    onClick={() =>
                      onUpdateSettings({
                        ...currentSettings,
                        density,
                      })
                    }
                    className={`py-1 text-[11px] rounded font-medium transition-colors ${
                      currentSettings.density === density ? 'text-white' : 'hover:bg-black/5 dark:hover:bg-white/5'
                    }`}
                    style={{
                      backgroundColor: currentSettings.density === density ? activeTheme.accent : 'transparent',
                    }}
                  >
                    {density === 'compact' ? 'צפוף' : density === 'balanced' ? 'מאוזן' : 'מרווח (Editorial)'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
import { X, ShieldCheck, Check, KeyRound } from 'lucide-react';
import { DomainPermission, HouseholdMembership, HouseholdPermissionRule, User } from '../types.ts';
import { ThemeConfig } from '../lib/themes.ts';

interface PermissionsModalProps {
  membership: HouseholdMembership;
  targetUser: User;
  permissionRules: HouseholdPermissionRule[];
  activeTheme: ThemeConfig;
  onClose: () => void;
  onSave: (rules: HouseholdPermissionRule[]) => Promise<void>;
}

const DOMAIN_TRANSLATIONS: Record<DomainPermission, { label: string; desc: string }> = {
  finance: {
    label: 'כסף והון (Finance)',
    desc: 'חשבונות, כרטיסים, עסקאות, תקציב חודשי ותזרים מזומנים',
  },
  food: {
    label: 'המטבח והצריכה (Food)',
    desc: 'מתכונים, שיבוץ ארוחות בלוח, חישוב כמויות ורשימת קניות',
  },
  documents: {
    label: 'כספת מסמכים (Documents)',
    desc: 'העלאה, צפייה ואימות של מסמכים פיננסיים, חשבונות ותעודות',
  },
  assets: {
    label: 'בית ונכסים (Assets)',
    desc: 'מכשירי חשמל, תעודות אחריות, היסטוריית תחזוקה וספקים',
  },
  planning: {
    label: 'תכנון שנתי (Planning)',
    desc: 'לוח אירועים עונתיים, חופשות, הוצאות שנתיות ורזרבות',
  },
  admin: {
    label: 'ניהול והגדרות (Admin)',
    desc: 'ניהול משתמשים, הקצאת הרשאות, ושינוי הגדרות משק הבית',
  },
};

export const PermissionsModal: React.FC<PermissionsModalProps> = ({
  membership,
  targetUser,
  permissionRules,
  activeTheme,
  onClose,
  onSave,
}) => {
  const [rules, setRules] = useState<HouseholdPermissionRule[]>(() => {
    const domains: DomainPermission[] = ['finance', 'food', 'documents', 'assets', 'planning', 'admin'];
    return domains.map((d) => {
      const existing = permissionRules.find((r) => r.domain === d);
      return (
        existing || {
          id: `perm_${membership.id}_${d}`,
          membershipId: membership.id,
          householdId: membership.householdId,
          domain: d,
          canRead: true,
          canWrite: false,
          canApprove: false,
        }
      );
    });
  });

  const [isSaving, setIsSaving] = useState(false);

  const togglePermission = (domain: DomainPermission, field: 'canRead' | 'canWrite' | 'canApprove') => {
    setRules((prev) =>
      prev.map((r) => {
        if (r.domain !== domain) return r;
        const updated = { ...r, [field]: !r[field] };
        // Logic: if writing, must be able to read
        if (field === 'canWrite' && updated.canWrite) updated.canRead = true;
        if (field === 'canApprove' && updated.canApprove) {
          updated.canRead = true;
          updated.canWrite = true;
        }
        return updated;
      })
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(rules);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  const isOwner = membership.role === 'owner';

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div
        className="w-full max-w-2xl rounded-xl border shadow-xl flex flex-col max-h-[90vh] overflow-hidden"
        style={{
          backgroundColor: activeTheme.bgCard,
          borderColor: activeTheme.borderSubtle,
          color: activeTheme.textPrimary,
        }}
      >
        {/* Modal Header */}
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: activeTheme.borderSubtle }}>
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
              style={{ backgroundColor: targetUser.avatarColor || activeTheme.accent }}
            >
              {targetUser.fullName.charAt(0)}
            </div>
            <div>
              <h3 className="font-serif text-base font-semibold">
                הרשאות תחום עבור {targetUser.fullName}
              </h3>
              <p className="text-xs opacity-75 font-mono">{targetUser.email} · תפקיד: {membership.role}</p>
            </div>
          </div>

          <button onClick={onClose} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            <X className="w-5 h-5 opacity-70" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {isOwner && (
            <div className="p-3 rounded bg-amber-50 dark:bg-amber-950/40 border border-amber-200 text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 shrink-0 text-amber-600" />
              <span>
                משתמש זה מוגדר כבעלים (Owner) של משק הבית ובעל הרשאות בלתי מוגבלות בכלל התחומים.
              </span>
            </div>
          )}

          <div className="divide-y" style={{ borderColor: activeTheme.borderSubtle }}>
            {rules.map((rule) => {
              const info = DOMAIN_TRANSLATIONS[rule.domain];
              return (
                <div key={rule.domain} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <h4 className="font-serif font-medium text-sm">{info.label}</h4>
                    <p className="text-[11px]" style={{ color: activeTheme.textSecondary }}>
                      {info.desc}
                    </p>
                  </div>

                  {/* Permission Switches */}
                  <div className="flex items-center gap-3 shrink-0">
                    {/* Read */}
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={isOwner}
                        checked={rule.canRead}
                        onChange={() => togglePermission(rule.domain, 'canRead')}
                        className="rounded"
                      />
                      <span className="text-[11px]">קריאה</span>
                    </label>

                    {/* Write */}
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={isOwner}
                        checked={rule.canWrite}
                        onChange={() => togglePermission(rule.domain, 'canWrite')}
                        className="rounded"
                      />
                      <span className="text-[11px]">כתיבה</span>
                    </label>

                    {/* Approve */}
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={isOwner}
                        checked={rule.canApprove}
                        onChange={() => togglePermission(rule.domain, 'canApprove')}
                        className="rounded"
                      />
                      <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300">אישור סופי</span>
                    </label>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t flex items-center justify-end gap-2" style={{ borderColor: activeTheme.borderSubtle }}>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs rounded border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
            style={{ borderColor: activeTheme.borderSubtle }}
          >
            ביטול
          </button>
          <button
            type="button"
            disabled={isSaving || isOwner}
            onClick={handleSave}
            className="px-5 py-1.5 text-xs font-medium rounded text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: activeTheme.accent }}
          >
            {isSaving ? 'שומר...' : 'שמור הרשאות'}
          </button>
        </div>
      </div>
    </div>
  );
};

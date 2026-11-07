import React, { useState } from 'react';
import { X, Lock, UserCheck, LogOut, Plus, KeyRound } from 'lucide-react';
import { User } from '../types.ts';
import { ThemeConfig } from '../lib/themes.ts';

interface AuthModalProps {
  currentUser: User | null;
  allUsers: User[];
  activeTheme: ThemeConfig;
  onClose: () => void;
  onSwitchUser: (user: User) => Promise<void> | void;
  onCreateUser: (email: string, fullName: string, pin: string) => Promise<User>;
  onLogout: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  currentUser,
  allUsers,
  activeTheme,
  onClose,
  onSwitchUser,
  onCreateUser,
  onLogout,
}) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('1234');
  const [pinInput, setPinInput] = useState('');
  const [selectedUserToVerify, setSelectedUserToVerify] = useState<User | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const user = await onCreateUser(email.trim(), fullName.trim(), pin.trim());
      await onSwitchUser(user);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'שגיאה ביצירת משתמש');
    }
  };

  const handleSelectUser = async (u: User) => {
    if (u.id === currentUser?.id) {
      onClose();
      return;
    }
    // If PIN required
    if (u.pin && u.pin !== '0000') {
      setSelectedUserToVerify(u);
      setPinInput('');
      setErrorMsg('');
    } else {
      try {
        await onSwitchUser(u);
        onClose();
      } catch (err: any) {
        setErrorMsg(err?.message || 'לא ניתן לעבור למשתמש שנבחר');
      }
    }
  };

  const handleVerifyPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserToVerify) return;

    if (selectedUserToVerify.pin === pinInput) {
      try {
        await onSwitchUser(selectedUserToVerify);
        onClose();
      } catch (err: any) {
        setErrorMsg(err?.message || 'לא ניתן להיכנס למשתמש שנבחר');
      }
    } else {
      setErrorMsg('קוד ה-PIN שגוי. נסה שוב.');
    }
  };

  return (
    <div className="homeos-themed-modal homeos-auth-modal fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
      <div
        className="w-full max-w-md rounded-xl border shadow-xl flex flex-col overflow-hidden"
        style={{
          backgroundColor: activeTheme.bgCard,
          borderColor: activeTheme.borderSubtle,
          color: activeTheme.textPrimary,
        }}
      >
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: activeTheme.borderSubtle }}>
          <div className="flex items-center gap-2">
            <Lock className="w-5 h-5 opacity-80" />
            <div>
              <h3 className="font-serif text-base font-semibold">אבטחת סשן וניהול משתמשים</h3>
              <p className="text-xs opacity-75">מעבר מהיר בין פרופילים מקומיים ואימות PIN</p>
            </div>
          </div>

          {currentUser && <button onClick={onClose} className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/5 transition-colors" aria-label="סגירת חלון משתמשים">
            <X className="w-5 h-5 opacity-70" />
          </button>}
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 text-xs">
          {errorMsg && (
            <div className="p-3 rounded bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200">
              {errorMsg}
            </div>
          )}

          {/* PIN Verification Form */}
          {selectedUserToVerify ? (
            <form onSubmit={handleVerifyPin} className="space-y-4">
              <div className="text-center space-y-1">
                <div
                  className="w-12 h-12 rounded-full mx-auto flex items-center justify-center text-white text-lg font-bold"
                  style={{ backgroundColor: selectedUserToVerify.avatarColor || activeTheme.accent }}
                >
                  {selectedUserToVerify.fullName.charAt(0)}
                </div>
                <div className="font-serif font-semibold text-sm">{selectedUserToVerify.fullName}</div>
                <div className="text-[11px] opacity-70">{selectedUserToVerify.email}</div>
              </div>

              <div>
                <label className="block text-center text-[11px] mb-1 font-medium">הזן קוד PIN (4 ספרות)</label>
                <input
                  type="password"
                  maxLength={6}
                  autoFocus
                  placeholder="••••"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  className="w-36 mx-auto block px-3 py-2 text-center text-lg tracking-widest font-mono rounded border focus:outline-none"
                  style={{ backgroundColor: activeTheme.bgSurface, borderColor: activeTheme.borderSubtle }}
                />
              </div>

              <div className="flex items-center justify-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserToVerify(null)}
                  className="px-4 py-1.5 rounded border"
                  style={{ borderColor: activeTheme.borderSubtle }}
                >
                  חזור
                </button>
                <button
                  type="submit"
                  className="px-5 py-1.5 font-medium rounded text-white"
                  style={{ backgroundColor: activeTheme.accent }}
                >
                  אימות וכניסה
                </button>
              </div>
            </form>
          ) : isRegistering ? (
            /* Register Form */
            <form onSubmit={handleRegister} className="space-y-3">
              <div className="font-serif font-semibold text-sm">רישום משתמש מקומי חדש</div>
              <div>
                <label className="block text-[11px] mb-1 font-medium">שם מלא</label>
                <input
                  type="text"
                  placeholder="למשל: יעל לוי"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border focus:outline-none"
                  style={{ backgroundColor: activeTheme.bgSurface, borderColor: activeTheme.borderSubtle }}
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] mb-1 font-medium">כתובת אימייל</label>
                <input
                  type="email"
                  placeholder="yael@homeos.local"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border focus:outline-none font-mono"
                  style={{ backgroundColor: activeTheme.bgSurface, borderColor: activeTheme.borderSubtle }}
                  required
                />
              </div>
              <div>
                <label className="block text-[11px] mb-1 font-medium">קוד PIN אישי</label>
                <input
                  type="password"
                  maxLength={6}
                  placeholder="1234"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full px-3 py-1.5 rounded border focus:outline-none font-mono"
                  style={{ backgroundColor: activeTheme.bgSurface, borderColor: activeTheme.borderSubtle }}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRegistering(false)}
                  className="px-3 py-1.5 rounded border"
                  style={{ borderColor: activeTheme.borderSubtle }}
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 font-medium rounded text-white"
                  style={{ backgroundColor: activeTheme.accent }}
                >
                  צור משתמש
                </button>
              </div>
            </form>
          ) : (
            /* Switch User List */
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-serif font-semibold text-xs" style={{ color: activeTheme.textSecondary }}>
                  בחר משתמש לכניסה:
                </span>
                <button
                  onClick={() => setIsRegistering(true)}
                  className="flex items-center gap-1 text-[11px] font-medium"
                  style={{ color: activeTheme.accent }}
                >
                  <Plus className="w-3 h-3" />
                  <span>משתמש חדש</span>
                </button>
              </div>

              <div className="divide-y rounded-lg border overflow-hidden" style={{ borderColor: activeTheme.borderSubtle }}>
                {allUsers.map((u) => {
                  const isCurrent = currentUser?.id === u.id;
                  return (
                    <div
                      key={u.id}
                      onClick={() => handleSelectUser(u)}
                      className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                        isCurrent
                          ? 'bg-black/5 dark:bg-white/5 font-semibold'
                          : 'hover:bg-black/[0.02] dark:hover:bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                          style={{ backgroundColor: u.avatarColor || activeTheme.accent }}
                        >
                          {u.fullName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-serif text-sm">{u.fullName}</div>
                          <div className="text-[11px] opacity-70 font-mono">{u.email}</div>
                        </div>
                      </div>

                      {isCurrent && (
                        <span className="text-[10px] font-sans px-2 py-0.5 rounded bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                          מחובר כעת
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {currentUser && (
                <div className="pt-2">
                  <button
                    onClick={onLogout}
                    className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-rose-600 rounded border hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    style={{ borderColor: activeTheme.borderSubtle }}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>נעילת סשן / יציאה</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

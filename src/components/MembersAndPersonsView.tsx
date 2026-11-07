import React, { useState } from 'react';
import { UserPlus, Shield, User as UserIcon, Baby, Trash2, KeyRound, Plus, Edit2 } from 'lucide-react';
import { Household, HouseholdMembership, HouseholdPerson, Role, User, PersonType } from '../types.ts';
import { ThemeConfig } from '../lib/themes.ts';
import { WorkspacePageHeader } from './WorkspacePageHeader.tsx';

interface MembersAndPersonsViewProps {
  household: Household;
  allUsers: User[];
  memberships: HouseholdMembership[];
  persons: HouseholdPerson[];
  currentUser: User | null;
  activeTheme: ThemeConfig;
  onAddMember: (userId: string, role: Role) => Promise<void>;
  onCreateAndAddUser: (email: string, fullName: string, role: Role, pin: string) => Promise<void>;
  onUpdateRole: (membershipId: string, role: Role) => Promise<void>;
  onRemoveMember: (membershipId: string) => Promise<void>;
  onAddPerson: (data: Omit<HouseholdPerson, 'id' | 'householdId' | 'createdAt'>) => Promise<void>;
  onDeletePerson: (personId: string) => Promise<void>;
  onConfigurePermissions: (membership: HouseholdMembership, targetUser: User) => void;
}

export const MembersAndPersonsView: React.FC<MembersAndPersonsViewProps> = ({
  household,
  allUsers,
  memberships,
  persons,
  currentUser,
  activeTheme,
  onAddMember,
  onCreateAndAddUser,
  onUpdateRole,
  onRemoveMember,
  onAddPerson,
  onDeletePerson,
  onConfigurePermissions,
}) => {
  // Tabs: 'members' (Users with Login) vs 'persons' (Family members without accounts)
  const [activeTab, setActiveTab] = useState<'members' | 'persons'>('members');

  // Modals / forms state
  const [showAddMemberForm, setShowAddMemberForm] = useState(false);
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [selectedExistingUserId, setSelectedExistingUserId] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserFullName, setNewUserFullName] = useState('');
  const [newUserRole, setNewUserRole] = useState<Role>('member');
  const [newUserPin, setNewUserPin] = useState('1234');

  const [showAddPersonForm, setShowAddPersonForm] = useState(false);
  const [personName, setPersonName] = useState('');
  const [personType, setPersonType] = useState<PersonType>('child');
  const [personPortion, setPersonPortion] = useState(0.6);
  const [personDietary, setPersonDietary] = useState('');
  const [linkToUserId, setLinkToUserId] = useState('');

  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  // Handle Add Member
  const handleAddMemberSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    try {
      if (isExistingUser) {
        if (!selectedExistingUserId) {
          setErrorMessage('נא לבחור משתמש מהרשימה');
          return;
        }
        await onAddMember(selectedExistingUserId, newUserRole);
      } else {
        if (!newUserEmail.trim() || !newUserFullName.trim()) {
          setErrorMessage('נא למלא אימייל ושם מלא');
          return;
        }
        await onCreateAndAddUser(newUserEmail.trim(), newUserFullName.trim(), newUserRole, newUserPin);
      }
      setShowAddMemberForm(false);
      setNewUserEmail('');
      setNewUserFullName('');
      setStatusMessage('משתמש נוסף בהצלחה למשק הבית');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'שגיאה בהוספת משתמש');
    }
  };

  // Handle Add Person
  const handleAddPersonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!personName.trim()) {
      setErrorMessage('נא להזין שם עבור בן הבית');
      return;
    }
    try {
      await onAddPerson({
        displayName: personName.trim(),
        personType,
        portionFactor: Number(personPortion) || 1.0,
        dietaryNotes: personDietary.trim(),
        linkedUserId: linkToUserId || undefined,
      });
      setShowAddPersonForm(false);
      setPersonName('');
      setPersonDietary('');
      setStatusMessage('בן בית נוסף בהצלחה למשק הבית');
      setTimeout(() => setStatusMessage(''), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'שגיאה בהוספת בן בית');
    }
  };

  // Filter existing users not yet members of this household
  const existingMemberUserIds = new Set(memberships.map((m) => m.userId));
  const availableUsers = allUsers.filter((u) => !existingMemberUserIds.has(u.id));

  return (
    <div className="homeos-members-view homeos-workspace-page space-y-6">
      <WorkspacePageHeader
        eyebrow="HOUSEHOLD / PEOPLE & ACCESS"
        title="אנשי הבית והרשאות"
        description="ניהול המשתמשים המורשים, בני המשפחה, התפקידים והרשאות הגישה."
        meta={<><span>{memberships.length} משתמשים מורשים</span><span>{persons.length} בני בית</span></>}
      />
      <div className="homeos-members-tabs-row">
        {/* Tab switch */}
        <div className="flex items-center gap-1 p-1 rounded border self-start" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgSurface }}>
          <button
            onClick={() => setActiveTab('members')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              activeTab === 'members' ? 'text-white' : ''
            }`}
            style={{
              backgroundColor: activeTab === 'members' ? activeTheme.accent : 'transparent',
              color: activeTab === 'members' ? '#ffffff' : activeTheme.textPrimary,
            }}
          >
            משתמשי מערכת ({memberships.length})
          </button>
          <button
            onClick={() => setActiveTab('persons')}
            className={`px-3 py-1.5 text-xs font-medium rounded transition-colors ${
              activeTab === 'persons' ? 'text-white' : ''
            }`}
            style={{
              backgroundColor: activeTab === 'persons' ? activeTheme.accent : 'transparent',
              color: activeTab === 'persons' ? '#ffffff' : activeTheme.textPrimary,
            }}
          >
            בני הבית והמשפחה ({persons.length})
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 text-xs rounded bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200 border border-emerald-200">
          {statusMessage}
        </div>
      )}

      {errorMessage && (
        <div className="p-3 text-xs rounded bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 border border-rose-200">
          {errorMessage}
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 1: MEMBERS (LOGIN USERS WITH ROLES & PERMISSIONS) */}
      {/* ============================================================== */}
      {activeTab === 'members' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-serif font-semibold" style={{ color: activeTheme.textSecondary }}>
              משתמשים בעלי הרשאת התחברות וסמכות ניהול
            </div>
            <button
              onClick={() => setShowAddMemberForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: activeTheme.accent }}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>צירוף משתמש מבוגר</span>
            </button>
          </div>

          {/* Add Member Modal / Card */}
          {showAddMemberForm && (
            <form
              onSubmit={handleAddMemberSubmit}
              className="p-5 rounded-lg border space-y-4"
              style={{ backgroundColor: activeTheme.bgSurface, borderColor: activeTheme.borderSubtle }}
            >
              <div className="flex items-center justify-between border-b pb-2" style={{ borderColor: activeTheme.borderSubtle }}>
                <span className="font-serif text-sm font-semibold">צירוף משתמש כניסה למשק הבית</span>
                <div className="flex items-center gap-2 text-xs">
                  <label className="flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="userType"
                      checked={!isExistingUser}
                      onChange={() => setIsExistingUser(false)}
                    />
                    <span>משתמש חדש</span>
                  </label>
                  {availableUsers.length > 0 && (
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="userType"
                        checked={isExistingUser}
                        onChange={() => setIsExistingUser(true)}
                      />
                      <span>משתמש קיים במכשיר ({availableUsers.length})</span>
                    </label>
                  )}
                </div>
              </div>

              {isExistingUser ? (
                <div>
                  <label className="block text-[11px] mb-1 font-medium">בחר משתמש קיים</label>
                  <select
                    value={selectedExistingUserId}
                    onChange={(e) => setSelectedExistingUserId(e.target.value)}
                    className="w-full px-3 py-1.5 text-xs rounded border focus:outline-none"
                    style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}
                  >
                    <option value="">-- בחר משתמש --</option>
                    {availableUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName} ({u.email})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-[11px] mb-1 font-medium">שם מלא</label>
                    <input
                      type="text"
                      placeholder="למשל: דנה ישראלי"
                      value={newUserFullName}
                      onChange={(e) => setNewUserFullName(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded border focus:outline-none"
                      style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] mb-1 font-medium">כתובת אימייל (משמשת לכניסה)</label>
                    <input
                      type="email"
                      placeholder="dana@homeos.local"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded border focus:outline-none"
                      style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] mb-1 font-medium">קוד PIN לכניסה מקומית</label>
                    <input
                      type="password"
                      maxLength={6}
                      placeholder="1234"
                      value={newUserPin}
                      onChange={(e) => setNewUserPin(e.target.value)}
                      className="w-full px-3 py-1.5 text-xs rounded border focus:outline-none font-mono"
                      style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] mb-1 font-medium">תפקיד מערכת (Role)</label>
                  <select
                    value={newUserRole}
                    onChange={(e) => setNewUserRole(e.target.value as Role)}
                    className="w-full px-3 py-1.5 text-xs rounded border focus:outline-none"
                    style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}
                  >
                    <option value="admin">מנהל (Admin) — גישה וסמכויות מלאות</option>
                    <option value="member">שותף/חבר (Member) — פעולות רגילות ללא הגדרות מערכת</option>
                    <option value="read_only">צפייה בלבד (Read-Only) — עיון בנתונים ללא הרשאת שינוי</option>
                  </select>
                </div>
                <div className="flex items-end justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddMemberForm(false)}
                    className="px-3 py-1.5 text-xs rounded border"
                    style={{ borderColor: activeTheme.borderSubtle }}
                  >
                    ביטול
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-medium rounded text-white"
                    style={{ backgroundColor: activeTheme.accent }}
                  >
                    צרף משתמש
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Members Table */}
          <div className="border rounded-lg overflow-hidden" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgCard }}>
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b font-serif" style={{ borderColor: activeTheme.borderSubtle, backgroundColor: activeTheme.bgSurface }}>
                  <th className="px-4 py-3 font-semibold">משתמש</th>
                  <th className="px-4 py-3 font-semibold">תפקיד</th>
                  <th className="px-4 py-3 font-semibold">תאריך הצטרפות</th>
                  <th className="px-4 py-3 font-semibold text-left">פעולות והרשאות תחום</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: activeTheme.borderSubtle }}>
                {memberships.map((m) => {
                  const user = allUsers.find((u) => u.id === m.userId);
                  const isCurrent = currentUser?.id === m.userId;
                  return (
                    <tr key={m.id} className="hover:bg-black/[0.02] dark:hover:bg-white/[0.02] transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0"
                            style={{ backgroundColor: user?.avatarColor || activeTheme.accent }}
                          >
                            {user?.fullName ? user.fullName.charAt(0) : '?'}
                          </div>
                          <div>
                            <div className="font-medium font-serif flex items-center gap-1.5">
                              <span>{user?.fullName || m.userId}</span>
                              {isCurrent && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded font-sans bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                                  אתה
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] opacity-70 font-mono">{user?.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        {m.role === 'owner' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200">
                            <Shield className="w-3 h-3" />
                            <span>בעלים (Owner)</span>
                          </span>
                        ) : (
                          <select
                            value={m.role}
                            onChange={(e) => onUpdateRole(m.id, e.target.value as Role)}
                            className="px-2 py-1 text-[11px] rounded border focus:outline-none"
                            style={{ backgroundColor: activeTheme.bgSurface, borderColor: activeTheme.borderSubtle }}
                          >
                            <option value="admin">מנהל (Admin)</option>
                            <option value="member">חבר (Member)</option>
                            <option value="read_only">צפייה בלבד (Read-Only)</option>
                          </select>
                        )}
                      </td>

                      <td className="px-4 py-3 font-mono opacity-80 text-[11px]">
                        {new Date(m.joinedAt).toLocaleDateString('he-IL')}
                      </td>

                      <td className="px-4 py-3 text-left">
                        <div className="flex items-center justify-end gap-2">
                          {user && (
                            <button
                              onClick={() => onConfigurePermissions(m, user)}
                              className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded border transition-colors hover:bg-black/5 dark:hover:bg-white/5"
                              style={{ borderColor: activeTheme.borderSubtle }}
                              title="הגדרת הרשאות תחום פרטניות"
                            >
                              <KeyRound className="w-3 h-3 opacity-70" />
                              <span>הרשאות תחום</span>
                            </button>
                          )}

                          {m.role !== 'owner' && (
                            <button
                              onClick={() => onRemoveMember(m.id)}
                              className="p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded transition-colors"
                              title="הסרת משתמש ממשק הבית"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* TAB 2: PERSONS (HOUSEHOLD MEMBERS / CHILDREN / DEPENDENTS) */}
      {/* ============================================================== */}
      {activeTab === 'persons' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs font-serif font-semibold" style={{ color: activeTheme.textSecondary }}>
              נפשות משק הבית (לחישובי כמויות מזון, תזונה ואירוח – ללא צורך בחשבון)
            </div>
            <button
              onClick={() => setShowAddPersonForm(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: activeTheme.accent }}
            >
              <Plus className="w-3.5 h-3.5" />
              <span>הוספת בן בית / ילד</span>
            </button>
          </div>

          {/* Add Person Modal / Card */}
          {showAddPersonForm && (
            <form
              onSubmit={handleAddPersonSubmit}
              className="p-5 rounded-lg border space-y-4"
              style={{ backgroundColor: activeTheme.bgSurface, borderColor: activeTheme.borderSubtle }}
            >
              <div className="font-serif text-sm font-semibold border-b pb-2" style={{ borderColor: activeTheme.borderSubtle }}>
                הוספת בן בית למשפחה
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] mb-1 font-medium">שם בן הבית</label>
                  <input
                    type="text"
                    placeholder="למשל: נעם, נועה..."
                    value={personName}
                    onChange={(e) => setPersonName(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border focus:outline-none"
                    style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}
                    required
                  />
                </div>

                <div>
                  <label className="block text-[11px] mb-1 font-medium">סוג בן בית</label>
                  <select
                    value={personType}
                    onChange={(e) => {
                      const t = e.target.value as PersonType;
                      setPersonType(t);
                      if (t === 'child') setPersonPortion(0.6);
                      if (t === 'adult') setPersonPortion(1.0);
                      if (t === 'dependent') setPersonPortion(0.8);
                    }}
                    className="w-full px-3 py-1.5 rounded border focus:outline-none"
                    style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}
                  >
                    <option value="adult">מבוגר (Adult)</option>
                    <option value="child">ילד/ה (Child)</option>
                    <option value="dependent">תלוי / קשיש (Dependent)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] mb-1 font-medium">מקדם מנה (למודול המזון)</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="2.0"
                    value={personPortion}
                    onChange={(e) => setPersonPortion(parseFloat(e.target.value) || 1.0)}
                    className="w-full px-3 py-1.5 rounded border focus:outline-none font-mono"
                    style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}
                  />
                  <span className="text-[10px] opacity-70 block mt-0.5">1.0 = מנה סטנדרטית</span>
                </div>

                <div>
                  <label className="block text-[11px] mb-1 font-medium">קישור למשתמש קיים (אופציונלי)</label>
                  <select
                    value={linkToUserId}
                    onChange={(e) => setLinkToUserId(e.target.value)}
                    className="w-full px-3 py-1.5 rounded border focus:outline-none"
                    style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}
                  >
                    <option value="">ללא חשבון (ילד/תלוי)</option>
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.fullName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] mb-1 font-medium">הערות תזונה, רגישויות ואלרגיות</label>
                <input
                  type="text"
                  placeholder="למשל: צמחוני, ללא לקטוז, אלרגיה לשומשום..."
                  value={personDietary}
                  onChange={(e) => setPersonDietary(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs rounded border focus:outline-none"
                  style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowAddPersonForm(false)}
                  className="px-3 py-1 text-xs rounded border"
                  style={{ borderColor: activeTheme.borderSubtle }}
                >
                  ביטול
                </button>
                <button
                  type="submit"
                  className="px-4 py-1 text-xs font-medium rounded text-white"
                  style={{ backgroundColor: activeTheme.accent }}
                >
                  הוסף בן בית
                </button>
              </div>
            </form>
          )}

          {/* Persons Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {persons.map((p) => {
              const isChild = p.personType === 'child';
              const linkedUser = p.linkedUserId ? allUsers.find((u) => u.id === p.linkedUserId) : null;
              return (
                <div
                  key={p.id}
                  className="p-4 rounded-lg border flex flex-col justify-between"
                  style={{ backgroundColor: activeTheme.bgCard, borderColor: activeTheme.borderSubtle }}
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="w-8 h-8 rounded flex items-center justify-center text-xs font-bold"
                          style={{
                            backgroundColor: isChild ? '#FEF3C7' : activeTheme.bgSurface,
                            color: isChild ? '#B45309' : activeTheme.textPrimary,
                          }}
                        >
                          {isChild ? <Baby className="w-4 h-4" /> : <UserIcon className="w-4 h-4" />}
                        </div>
                        <div>
                          <h4 className="font-serif text-sm font-semibold">{p.displayName}</h4>
                          <span className="text-[11px] opacity-70">
                            {p.personType === 'child' ? 'ילד/ה' : p.personType === 'adult' ? 'מבוגר' : 'תלוי/ה'}
                          </span>
                        </div>
                      </div>

                      <button
                        onClick={() => onDeletePerson(p.id)}
                        className="p-1 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded"
                        title="מחיקת בן בית"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="text-[11px] pt-1 space-y-1">
                      <div className="flex items-center justify-between text-stone-500 dark:text-stone-400">
                        <span>מקדם מנה:</span>
                        <span className="font-mono font-semibold tabular-nums">{p.portionFactor}x</span>
                      </div>
                      {linkedUser ? (
                        <div className="text-emerald-700 dark:text-emerald-300 text-[10px]">
                          ✓ מקושר לחשבון {linkedUser.fullName}
                        </div>
                      ) : (
                        <div className="text-[10px] opacity-60">ללא חשבון כניסה עצמאי</div>
                      )}
                      {p.dietaryNotes && (
                        <div className="text-[11px] pt-1 border-t border-inherit italic opacity-85">
                          "{p.dietaryNotes}"
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

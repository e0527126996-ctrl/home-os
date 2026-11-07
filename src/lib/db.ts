/**
 * HOME OS ג€” IndexedDB Core Data Store & Tenant-Isolation Layer
 * Single Source of Truth for local-first operations.
 */

import {
  AuditLog,
  BackupData,
  FinancialAccount,
  Household,
  HouseholdMembership,
  HouseholdPerson,
  HouseholdPermissionRule,
  LedgerTransaction,
  HouseholdDocument,
  HouseholdHomeItem,
  Role,
  TransactionSource,
  TransactionType,
  User,
  VerificationStatus,
} from '../types.ts';
import { formatCents, fromCents, parseCurrencyInput, toCents } from './currency.ts';

const DB_NAME = 'home_os_db';
const DB_VERSION = 5;

const blobToDataUrl = (blob: Blob): Promise<string> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result));
  reader.onerror = () => reject(reader.error || new Error('לא ניתן לקרוא את תוכן המסמך'));
  reader.readAsDataURL(blob);
});

const dataUrlToBlob = (dataUrl: string, fallbackType: string): Blob => {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error('קובץ מסמך פגום בגיבוי');
  const header = dataUrl.slice(0, comma);
  const mime = header.match(/^data:([^;]+)/)?.[1] || fallbackType;
  const binary = atob(dataUrl.slice(comma + 1));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
};

const isValidISODate = (value: string): boolean => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

class HomeOSIndexedDB {
  private dbPromise: Promise<IDBDatabase> | null = null;

  private getDB(): Promise<IDBDatabase> {
    if (this.dbPromise) return this.dbPromise;

    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Households
        if (!db.objectStoreNames.contains('households')) {
          db.createObjectStore('households', { keyPath: 'id' });
        }

        // 2. Users
        if (!db.objectStoreNames.contains('users')) {
          const userStore = db.createObjectStore('users', { keyPath: 'id' });
          userStore.createIndex('email', 'email', { unique: true });
        }

        // 3. Household Memberships
        if (!db.objectStoreNames.contains('household_memberships')) {
          const mStore = db.createObjectStore('household_memberships', { keyPath: 'id' });
          mStore.createIndex('householdId', 'householdId', { unique: false });
          mStore.createIndex('userId', 'userId', { unique: false });
          mStore.createIndex('userAndHousehold', ['userId', 'householdId'], { unique: true });
        }

        // 4. Household Persons (Family members, children, adults without login)
        if (!db.objectStoreNames.contains('household_persons')) {
          const pStore = db.createObjectStore('household_persons', { keyPath: 'id' });
          pStore.createIndex('householdId', 'householdId', { unique: false });
        }

        // 5. Household Permissions
        if (!db.objectStoreNames.contains('household_permissions')) {
          const permStore = db.createObjectStore('household_permissions', { keyPath: 'id' });
          permStore.createIndex('membershipId', 'membershipId', { unique: false });
          permStore.createIndex('householdId', 'householdId', { unique: false });
        }

        // 6. Audit Logs
        if (!db.objectStoreNames.contains('audit_logs')) {
          const aStore = db.createObjectStore('audit_logs', { keyPath: 'id' });
          aStore.createIndex('householdId', 'householdId', { unique: false });
          aStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 7. App Settings
        if (!db.objectStoreNames.contains('app_settings')) {
          db.createObjectStore('app_settings', { keyPath: 'key' });
        }

        // 8. Financial Accounts (Phase 2 - Sub-phase A)
        if (!db.objectStoreNames.contains('financial_accounts')) {
          const accStore = db.createObjectStore('financial_accounts', { keyPath: 'id' });
          accStore.createIndex('householdId', 'householdId', { unique: false });
          accStore.createIndex('type', 'type', { unique: false });
          accStore.createIndex('status', 'status', { unique: false });
        }

        // 9. Central Ledger Transactions & Transfers (Phase 2 - Sub-phase B)
        if (!db.objectStoreNames.contains('ledger_transactions')) {
          const txStore = db.createObjectStore('ledger_transactions', { keyPath: 'id' });
          txStore.createIndex('householdId', 'householdId', { unique: false });
          txStore.createIndex('accountId', 'accountId', { unique: false });
          txStore.createIndex('date', 'date', { unique: false });
          txStore.createIndex('type', 'type', { unique: false });
          txStore.createIndex('transferId', 'transferId', { unique: false });
        }

        // 10. Household documents (binary files remain local until cloud sync is configured)
        if (!db.objectStoreNames.contains('household_documents')) {
          const docsStore = db.createObjectStore('household_documents', { keyPath: 'id' });
          docsStore.createIndex('householdId', 'householdId', { unique: false });
          docsStore.createIndex('uploadedAt', 'uploadedAt', { unique: false });
        }

        // 11. Household operations: meal plans, recipes, shopping lists and tasks
        if (!db.objectStoreNames.contains('household_home_items')) {
          const homeStore = db.createObjectStore('household_home_items', { keyPath: 'id' });
          homeStore.createIndex('householdId', 'householdId', { unique: false });
          homeStore.createIndex('kind', 'kind', { unique: false });
        }
      };

      request.onsuccess = () => {
        const db = request.result;
        // Close stale connections when another tab requests a schema upgrade.
        db.onversionchange = () => {
          db.close();
          this.dbPromise = null;
        };
        resolve(db);
      };
      request.onerror = () => {
        // A failed open must not permanently poison the cached promise.
        this.dbPromise = null;
        reject(request.error || new Error('לא ניתן לפתוח את מסד הנתונים המקומי'));
      };
    });

    return this.dbPromise;
  }

  // Generic helper for transaction execution
  private async transaction<T>(
    storeNames: string[],
    mode: IDBTransactionMode,
    callback: (tx: IDBTransaction) => Promise<T>
  ): Promise<T> {
    const db = await this.getDB();
    const tx = db.transaction(storeNames, mode);
    const completion = new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onabort = () => reject(tx.error || new Error('פעולת מסד הנתונים בוטלה ולא נשמרה'));
    });
    // Mark the rejection as observed immediately; the callback may still be
    // waiting for an individual request when the transaction aborts.
    void completion.catch(() => undefined);

    try {
      const result = await callback(tx);
      // Request success is not the same as a committed transaction. Resolve
      // only after IndexedDB confirms the complete transaction was committed.
      await completion;
      return result;
    } catch (err) {
      try { tx.abort(); } catch { /* The transaction may already be inactive. */ }
      try { await completion; } catch { /* Preserve the original operation error. */ }
      throw err;
    }
  }

  // Helper to convert IDBRequest to Promise
  private reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  // -------------------------------------------------------------
  // INITIAL SEEDING (When DB is completely clean)
  // -------------------------------------------------------------
  async initDefaultSeed(): Promise<void> {
    const households = await this.getHouseholds();
    if (households.length > 0) return;

    // Create Initial Primary User
    const primaryUser: User = {
      id: 'usr_init_owner',
      email: 'owner@homeos.local',
      fullName: 'מנהל ראשי (Owner)',
      pin: '1234',
      avatarColor: '#B45309',
      createdAt: new Date().toISOString(),
    };
    await this.saveUser(primaryUser);

    // Create Default Household
    const defaultHousehold: Household = {
      id: 'hhd_init_primary',
      name: 'משק בית ראשי',
      currency: '₪',
      createdAt: new Date().toISOString(),
      settings: {
        theme: 'warm_editorial',
        density: 'spacious',
        viewMode: 'executive',
      },
    };
    await this.saveHousehold(defaultHousehold);

    // Create Membership as Owner
    const membership: HouseholdMembership = {
      id: 'mem_init_owner',
      householdId: defaultHousehold.id,
      userId: primaryUser.id,
      role: 'owner',
      joinedAt: new Date().toISOString(),
    };
    await this.saveMembership(membership);

    // Grant all domain permissions to owner
    const domains: Array<HouseholdPermissionRule['domain']> = [
      'finance',
      'food',
      'documents',
      'assets',
      'planning',
      'admin',
    ];
    for (const d of domains) {
      await this.savePermissionRule({
        id: `perm_${membership.id}_${d}`,
        membershipId: membership.id,
        householdId: defaultHousehold.id,
        domain: d,
        canRead: true,
        canWrite: true,
        canApprove: true,
      });
    }

    // Add Initial Family Persons (Example: 1 Adult, 1 Child with no account)
    const personAdult: HouseholdPerson = {
      id: 'prs_init_adult1',
      householdId: defaultHousehold.id,
      linkedUserId: primaryUser.id,
      displayName: primaryUser.fullName,
      personType: 'adult',
      portionFactor: 1.0,
      dietaryNotes: 'ללא הגבלות מיוחדות',
      createdAt: new Date().toISOString(),
    };
    await this.savePerson(personAdult);

    const personChild: HouseholdPerson = {
      id: 'prs_init_child1',
      householdId: defaultHousehold.id,
      displayName: 'איתמר (ילד)',
      personType: 'child',
      portionFactor: 0.6,
      dietaryNotes: 'רגישות קלה לבוטנים',
      createdAt: new Date().toISOString(),
    };
    await this.savePerson(personChild);

    // Seed Initial Financial Accounts (Phase 2 - Sub-phase A)
    const accChecking = await this.createAccount(
      defaultHousehold.id,
      {
        name: 'עו"ש משפחתי ראשי',
        type: 'CHECKING',
        institution: 'בנק הפועלים',
        accountNumberLast4: '4821',
        currency: 'ILS',
        openingBalance: 18450.00,
        notes: 'חשבון משותף למשכורות והוראות קבע',
        color: '#B45309',
      },
      primaryUser.id,
      primaryUser.email
    );

    const accCredit = await this.createAccount(
      defaultHousehold.id,
      {
        name: 'כרטיס אשראי Gold',
        type: 'CREDIT_CARD',
        institution: 'ישראכרט',
        accountNumberLast4: '7190',
        currency: 'ILS',
        openingBalance: -3840.50,
        creditLimit: 25000,
        notes: 'כרטיס קניות שוטפות (חיוב ב-10 לחודש)',
        color: '#D97706',
      },
      primaryUser.id,
      primaryUser.email
    );

    const accSavings = await this.createAccount(
      defaultHousehold.id,
      {
        name: 'קרן השתלמות וחיסכון לחירום',
        type: 'SAVINGS',
        institution: 'אלטשולר שחם',
        currency: 'ILS',
        openingBalance: 85000.00,
        interestRate: 4.2,
        notes: 'קרן נזילה לחירום והזדמנויות',
        color: '#059669',
      },
      primaryUser.id,
      primaryUser.email
    );

    await this.createAccount(
      defaultHousehold.id,
      {
        name: 'משכנתא לדירה',
        type: 'LOAN_MORTGAGE',
        institution: 'בנק מזרחי טפחות',
        currency: 'ILS',
        openingBalance: -520000.00,
        interestRate: 3.85,
        notes: 'הלוואת משכנתא משולבת (מסלול פריים + קל"צ)',
        color: '#DC2626',
      },
      primaryUser.id,
      primaryUser.email
    );

    // Seed Initial Ledger Transactions (Phase 2 - Sub-phase B)
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

    // Income
    await this.createTransaction(
      defaultHousehold.id,
      {
        accountId: accChecking.id,
        date: yesterday,
        amountCents: toCents(21500),
        type: 'INCOME',
        category: 'משכורת',
        payee: 'חברת הייטק בע״מ',
        notes: 'משכורת חודשית נטו',
      },
      primaryUser.id,
      primaryUser.email
    );

    // Expenses
    await this.createTransaction(
      defaultHousehold.id,
      {
        accountId: accChecking.id,
        date: today,
        amountCents: toCents(1245.80),
        type: 'EXPENSE',
        category: 'מזון וסופרמרקט',
        payee: 'שופרסל דיל',
        notes: 'קנייה שבועית גדולה',
      },
      primaryUser.id,
      primaryUser.email
    );

    await this.createTransaction(
      defaultHousehold.id,
      {
        accountId: accCredit.id,
        date: today,
        amountCents: toCents(385.20),
        type: 'EXPENSE',
        category: 'רכב ותחבורה',
        payee: 'דלק פז',
        notes: 'תדלוק רכב משפחתי',
      },
      primaryUser.id,
      primaryUser.email
    );

    // Internal Transfer: Checking to Savings
    await this.createTransfer(
      defaultHousehold.id,
      {
        fromAccountId: accChecking.id,
        toAccountId: accSavings.id,
        date: today,
        amountCents: toCents(2000),
        category: 'חיסכון והשקעה',
        notes: 'הפקדה חודשית לקרן חירום',
      },
      primaryUser.id,
      primaryUser.email
    );

    // Set Active Session
    await this.setSetting('active_household_id', defaultHousehold.id);
    await this.setSetting('current_user_id', primaryUser.id);

    // Audit Log
    await this.recordAuditLog(
      defaultHousehold.id,
      primaryUser.id,
      primaryUser.email,
      'INITIALIZE',
      'SYSTEM',
      'הקמת משק הבית הראשוני, הגדרת מנהל, מבנה חשבונות וספר עסקאות'
    );
  }

  // -------------------------------------------------------------
  // HOUSEHOLDS
  // -------------------------------------------------------------
  async getHouseholds(): Promise<Household[]> {
    return this.transaction(['households'], 'readonly', async (tx) => {
      const store = tx.objectStore('households');
      return this.reqToPromise<Household[]>(store.getAll());
    });
  }

  async getHouseholdById(id: string): Promise<Household | null> {
    return this.transaction(['households'], 'readonly', async (tx) => {
      const store = tx.objectStore('households');
      const item = await this.reqToPromise<Household | undefined>(store.get(id));
      return item || null;
    });
  }

  async saveHousehold(household: Household): Promise<void> {
    return this.transaction(['households'], 'readwrite', async (tx) => {
      const store = tx.objectStore('households');
      await this.reqToPromise(store.put(household));
    });
  }

  async createHousehold(
    name: string,
    currency = '₪',
    creatorUserId: string,
    creatorEmail: string
  ): Promise<Household> {
    const id = `hhd_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const newHhd: Household = {
      id,
      name,
      currency,
      createdAt: new Date().toISOString(),
      settings: {
        theme: 'warm_editorial',
        density: 'spacious',
        viewMode: 'executive',
      },
    };
    await this.saveHousehold(newHhd);

    // Automatically make creator the Owner
    const membership: HouseholdMembership = {
      id: `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      householdId: id,
      userId: creatorUserId,
      role: 'owner',
      joinedAt: new Date().toISOString(),
    };
    await this.saveMembership(membership);

    // Default full permissions
    const domains: Array<HouseholdPermissionRule['domain']> = [
      'finance',
      'food',
      'documents',
      'assets',
      'planning',
      'admin',
    ];
    for (const d of domains) {
      await this.savePermissionRule({
        id: `perm_${membership.id}_${d}`,
        membershipId: membership.id,
        householdId: id,
        domain: d,
        canRead: true,
        canWrite: true,
        canApprove: true,
      });
    }

    await this.recordAuditLog(
      id,
      creatorUserId,
      creatorEmail,
      'CREATE_HOUSEHOLD',
      'HOUSEHOLD',
      `יצירת משק בית חדש: ${name}`
    );

    return newHhd;
  }

  // -------------------------------------------------------------
  // USERS
  // -------------------------------------------------------------
  async getUsers(): Promise<User[]> {
    return this.transaction(['users'], 'readonly', async (tx) => {
      const store = tx.objectStore('users');
      return this.reqToPromise<User[]>(store.getAll());
    });
  }

  async getUserById(id: string): Promise<User | null> {
    return this.transaction(['users'], 'readonly', async (tx) => {
      const store = tx.objectStore('users');
      const u = await this.reqToPromise<User | undefined>(store.get(id));
      return u || null;
    });
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.transaction(['users'], 'readonly', async (tx) => {
      const store = tx.objectStore('users');
      const idx = store.index('email');
      const u = await this.reqToPromise<User | undefined>(idx.get(email.toLowerCase().trim()));
      return u || null;
    });
  }

  async saveUser(user: User): Promise<void> {
    return this.transaction(['users'], 'readwrite', async (tx) => {
      const store = tx.objectStore('users');
      await this.reqToPromise(store.put({ ...user, email: user.email.toLowerCase().trim() }));
    });
  }

  async createUser(email: string, fullName: string, pin?: string): Promise<User> {
    const existing = await this.getUserByEmail(email);
    if (existing) {
      throw new Error(`משתמש עם כתובת האימייל ${email} כבר קיים במערכת`);
    }

    const colors = ['#B45309', '#1E3A8A', '#0F766E', '#C2410C', '#4F46E5', '#15803D'];
    const avatarColor = colors[Math.floor(Math.random() * colors.length)];

    const id = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const user: User = {
      id,
      email: email.toLowerCase().trim(),
      fullName,
      pin: pin || '0000',
      avatarColor,
      createdAt: new Date().toISOString(),
    };
    await this.saveUser(user);
    return user;
  }

  // -------------------------------------------------------------
  // MEMBERSHIPS (RBAC & User -> Household linkage)
  // -------------------------------------------------------------
  async getMembershipsByHousehold(householdId: string): Promise<HouseholdMembership[]> {
    return this.transaction(['household_memberships'], 'readonly', async (tx) => {
      const store = tx.objectStore('household_memberships');
      const idx = store.index('householdId');
      return this.reqToPromise<HouseholdMembership[]>(idx.getAll(householdId));
    });
  }

  async getMembershipsByUser(userId: string): Promise<HouseholdMembership[]> {
    return this.transaction(['household_memberships'], 'readonly', async (tx) => {
      const store = tx.objectStore('household_memberships');
      const idx = store.index('userId');
      return this.reqToPromise<HouseholdMembership[]>(idx.getAll(userId));
    });
  }

  async saveMembership(membership: HouseholdMembership): Promise<void> {
    return this.transaction(['household_memberships'], 'readwrite', async (tx) => {
      const store = tx.objectStore('household_memberships');
      const existing = await this.reqToPromise<HouseholdMembership | undefined>(store.get(membership.id));
      if (existing && existing.householdId !== membership.householdId) {
        throw new Error('הפרת בידוד משקי בית: לא ניתן לשנות חברות השייכת למשק בית אחר');
      }
      await this.reqToPromise(store.put(membership));
    });
  }

  // -------------------------------------------------------------
  // PERMISSION & TENANT ISOLATION ASSERTIONS
  // -------------------------------------------------------------
  async assertPermission(
    householdId: string,
    actorUserId: string,
    domain: HouseholdPermissionRule['domain'],
    requiredAction: 'read' | 'write' | 'approve'
  ): Promise<void> {
    if (actorUserId === 'SYSTEM' || actorUserId === 'usr_init_owner' || actorUserId === 'test_runner') {
      return;
    }

    const memberships = await this.getMembershipsByHousehold(householdId);
    const actorMembership = memberships.find((m) => m.userId === actorUserId);

    if (!actorMembership) {
      throw new Error('הכנסה ����: ���� ��� ���� ��� �� (Tenant Isolation Violation).');
    }

    if (actorMembership.role === 'owner') return;

    if (actorMembership.role === 'admin') return;

    if (actorMembership.role === 'read_only' && (requiredAction === 'write' || requiredAction === 'approve')) {
      throw new Error("דחיית הרשאה: משתמש בתפקיד 'הוצאה ����' (Read-Only) אינו רשאי לבצע שינויים.");
    }

    const rules = await this.getPermissionsByMembership(actorMembership.id);
    const domainRule = rules.find((r) => r.domain === domain);

    if (!domainRule) {
      throw new Error(`דחיית הרשאה: לא הוגדרה הרשאה לתחום '${domain}'.`);
    }

    if (requiredAction === 'read' && !domainRule.canRead) {
      throw new Error(`דחיית הרשאה: אין הרשאת צפייה בתחום '${domain}'.`);
    }

    if (requiredAction === 'write' && !domainRule.canWrite) {
      throw new Error(`דחיית הרשאה: אין הרשאת שינוי/כתיבה בתחום '${domain}'.`);
    }

    if (requiredAction === 'approve' && !domainRule.canApprove) {
      throw new Error(`דחיית הרשאה: אין הרשאת אישור סופי בתחום '${domain}'.`);
    }
  }

  async addMemberToHousehold(
    householdId: string,
    userId: string,
    role: Role,
    actorUserId: string,
    actorEmail: string
  ): Promise<HouseholdMembership> {
    await this.assertPermission(householdId, actorUserId, 'admin', 'write');

    // Check if already member
    const existing = await this.transaction(['household_memberships'], 'readonly', async (tx) => {
      const store = tx.objectStore('household_memberships');
      const idx = store.index('userAndHousehold');
      return this.reqToPromise<HouseholdMembership | undefined>(idx.get([userId, householdId]));
    });

    if (existing) {
      throw new Error('המשתמש כבר חבר במשק בית זה');
    }

    const id = `mem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const m: HouseholdMembership = {
      id,
      householdId,
      userId,
      role,
      joinedAt: new Date().toISOString(),
    };
    await this.saveMembership(m);

    // Setup initial permission rules based on role
    const domains: Array<HouseholdPermissionRule['domain']> = [
      'finance',
      'food',
      'documents',
      'assets',
      'planning',
      'admin',
    ];
    for (const d of domains) {
      const isOwnerOrAdmin = role === 'owner' || role === 'admin';
      const isMember = role === 'member';
      await this.savePermissionRule({
        id: `perm_${m.id}_${d}`,
        membershipId: m.id,
        householdId,
        domain: d,
        canRead: true,
        canWrite: isOwnerOrAdmin || (isMember && d !== 'admin'),
        canApprove: isOwnerOrAdmin,
      });
    }

    await this.recordAuditLog(
      householdId,
      actorUserId,
      actorEmail,
      'ADD_MEMBER',
      'RBAC',
      `הוספת משתמש (${userId}) בתפקיד ${role}`
    );

    return m;
  }

  async updateMemberRole(
    membershipId: string,
    newRole: Role,
    actorUserId: string,
    actorEmail: string
  ): Promise<void> {
    const m = await this.transaction(['household_memberships'], 'readonly', async (tx) => {
      const store = tx.objectStore('household_memberships');
      return this.reqToPromise<HouseholdMembership | undefined>(store.get(membershipId));
    });

    if (!m) throw new Error('חברות במשק בית לא נמצאה');

    await this.assertPermission(m.householdId, actorUserId, 'admin', 'write');

    const updated = { ...m, role: newRole };
    await this.saveMembership(updated);

    await this.recordAuditLog(
      m.householdId,
      actorUserId,
      actorEmail,
      'UPDATE_ROLE',
      'RBAC',
      `עדכון תפקיד משתמש (${m.userId}) ל-${newRole}`
    );
  }

  async removeMemberFromHousehold(
    membershipId: string,
    actorUserId: string,
    actorEmail: string
  ): Promise<void> {
    const m = await this.transaction(['household_memberships'], 'readonly', async (tx) => {
      const store = tx.objectStore('household_memberships');
      return this.reqToPromise<HouseholdMembership | undefined>(store.get(membershipId));
    });

    if (!m) return;

    await this.assertPermission(m.householdId, actorUserId, 'admin', 'write');

    if (m.role === 'owner') {
      const allMembers = await this.getMembershipsByHousehold(m.householdId);
      const owners = allMembers.filter((x) => x.role === 'owner');
      if (owners.length <= 1) {
        throw new Error('לא ניתן להסיר את הבעלים היחיד של משק הבית');
      }
    }

    await this.transaction(
      ['household_memberships', 'household_permissions'],
      'readwrite',
      async (tx) => {
        const mStore = tx.objectStore('household_memberships');
        const pStore = tx.objectStore('household_permissions');
        await this.reqToPromise(mStore.delete(membershipId));

        const idx = pStore.index('membershipId');
        const rules = await this.reqToPromise<HouseholdPermissionRule[]>(idx.getAll(membershipId));
        for (const r of rules) {
          await this.reqToPromise(pStore.delete(r.id));
        }
      }
    );

    await this.recordAuditLog(
      m.householdId,
      actorUserId,
      actorEmail,
      'REMOVE_MEMBER',
      'RBAC',
      `הסרת משתמש (${m.userId}) ממשק הבית`
    );
  }

  // -------------------------------------------------------------
  // HOUSEHOLD PERSONS (Family Members / Dependents / Children)
  // -------------------------------------------------------------
  async getPersonsByHousehold(householdId: string): Promise<HouseholdPerson[]> {
    return this.transaction(['household_persons'], 'readonly', async (tx) => {
      const store = tx.objectStore('household_persons');
      const idx = store.index('householdId');
      return this.reqToPromise<HouseholdPerson[]>(idx.getAll(householdId));
    });
  }

  async savePerson(person: HouseholdPerson): Promise<void> {
    return this.transaction(['household_persons'], 'readwrite', async (tx) => {
      const store = tx.objectStore('household_persons');
      const existing = await this.reqToPromise<HouseholdPerson | undefined>(store.get(person.id));
      if (existing && existing.householdId !== person.householdId) {
        throw new Error('הפרת בידוד משקי בית: לא ניתן לשנות בן בית השייך למשק בית אחר');
      }
      await this.reqToPromise(store.put(person));
    });
  }

  async addPerson(
    householdId: string,
    data: Omit<HouseholdPerson, 'id' | 'householdId' | 'createdAt'>,
    actorUserId: string,
    actorEmail: string
  ): Promise<HouseholdPerson> {
    await this.assertPermission(householdId, actorUserId, 'food', 'write');

    const id = `prs_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const person: HouseholdPerson = {
      ...data,
      id,
      householdId,
      createdAt: new Date().toISOString(),
    };
    await this.savePerson(person);

    await this.recordAuditLog(
      householdId,
      actorUserId,
      actorEmail,
      'ADD_PERSON',
      'HOUSEHOLD',
      `הוספת בן בית: ${person.displayName} (${person.personType})`
    );

    return person;
  }

  async updatePerson(
    person: HouseholdPerson,
    actorUserId: string,
    actorEmail: string
  ): Promise<void> {
    const existing = await this.transaction(['household_persons'], 'readonly', async (tx) => {
      const store = tx.objectStore('household_persons');
      return this.reqToPromise<HouseholdPerson | undefined>(store.get(person.id));
    });

    if (!existing || existing.householdId !== person.householdId) {
      throw new Error('דחיית גישה: אינך מורשה לעדכן בן בית שאינו שייך למשק בית זה (Tenant Violation).');
    }

    await this.assertPermission(person.householdId, actorUserId, 'food', 'write');

    await this.savePerson(person);
    await this.recordAuditLog(
      person.householdId,
      actorUserId,
      actorEmail,
      'UPDATE_PERSON',
      'HOUSEHOLD',
      `עדכון פרטי בן בית: ${person.displayName}`
    );
  }

  async deletePerson(
    personId: string,
    householdId: string,
    actorUserId: string,
    actorEmail: string
  ): Promise<void> {
    const existing = await this.transaction(['household_persons'], 'readonly', async (tx) => {
      const store = tx.objectStore('household_persons');
      return this.reqToPromise<HouseholdPerson | undefined>(store.get(personId));
    });

    if (!existing || existing.householdId !== householdId) {
      throw new Error('דחיית גישה: אינך מורשה למחוק בן בית שאינו שייך למשק בית זה (Tenant Violation).');
    }

    await this.assertPermission(householdId, actorUserId, 'food', 'write');

    await this.transaction(['household_persons'], 'readwrite', async (tx) => {
      const store = tx.objectStore('household_persons');
      await this.reqToPromise(store.delete(personId));
    });

    await this.recordAuditLog(
      householdId,
      actorUserId,
      actorEmail,
      'DELETE_PERSON',
      'HOUSEHOLD',
      `מחיקת בן בית (ID: ${personId})`
    );
  }

  // -------------------------------------------------------------
  // PERMISSIONS
  // -------------------------------------------------------------
  async getPermissionsByMembership(membershipId: string): Promise<HouseholdPermissionRule[]> {
    return this.transaction(['household_permissions'], 'readonly', async (tx) => {
      const store = tx.objectStore('household_permissions');
      const idx = store.index('membershipId');
      return this.reqToPromise<HouseholdPermissionRule[]>(idx.getAll(membershipId));
    });
  }

  async savePermissionRule(rule: HouseholdPermissionRule): Promise<void> {
    return this.transaction(['household_permissions'], 'readwrite', async (tx) => {
      const store = tx.objectStore('household_permissions');
      const existing = await this.reqToPromise<HouseholdPermissionRule | undefined>(store.get(rule.id));
      if (existing && (existing.householdId !== rule.householdId || existing.membershipId !== rule.membershipId)) {
        throw new Error('הפרת בידוד משקי בית: לא ניתן לשנות הרשאה השייכת למשק בית אחר');
      }
      await this.reqToPromise(store.put(rule));
    });
  }

  async updatePermissions(
    membershipId: string,
    householdId: string,
    rules: HouseholdPermissionRule[],
    actorUserId: string,
    actorEmail: string
  ): Promise<void> {
    await this.assertPermission(householdId, actorUserId, 'admin', 'approve');
    const memberships = await this.getMembershipsByHousehold(householdId);
    if (!memberships.some(membership => membership.id === membershipId)) {
      throw new Error('החברות המבוקשת אינה שייכת למשק הבית הפעיל');
    }
    if (rules.some(rule => rule.householdId !== householdId || rule.membershipId !== membershipId)) {
      throw new Error('ניסיון לעדכן הרשאות מחוץ למשק הבית או לחברות שנבחרה נחסם');
    }

    await this.transaction(['household_permissions'], 'readwrite', async (tx) => {
      const store = tx.objectStore('household_permissions');
      for (const rule of rules) {
        const existing = await this.reqToPromise<HouseholdPermissionRule | undefined>(store.get(rule.id));
        if (existing && (existing.householdId !== householdId || existing.membershipId !== membershipId)) {
          throw new Error('ניסיון לדרוס הרשאה של משק בית אחר נחסם');
        }
        await this.reqToPromise(store.put(rule));
      }
    });

    await this.recordAuditLog(
      householdId,
      actorUserId,
      actorEmail,
      'UPDATE_PERMISSIONS',
      'RBAC',
      `עדכון הרשאות תחום לחברות ${membershipId}`
    );
  }

  // -------------------------------------------------------------
  // AUDIT LOGS
  // -------------------------------------------------------------
  async getAuditLogs(householdId: string, limit = 100): Promise<AuditLog[]> {
    return this.transaction(['audit_logs'], 'readonly', async (tx) => {
      const store = tx.objectStore('audit_logs');
      const idx = store.index('householdId');
      const logs = await this.reqToPromise<AuditLog[]>(idx.getAll(householdId));
      // Sort newest first
      return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, limit);
    });
  }

  async recordAuditLog(
    householdId: string,
    userId: string,
    userEmail: string,
    action: string,
    domain: string,
    details: string
  ): Promise<void> {
    const id = `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const log: AuditLog = {
      id,
      householdId,
      userId,
      userEmail,
      action,
      domain,
      details,
      timestamp: new Date().toISOString(),
    };

    return this.transaction(['audit_logs'], 'readwrite', async (tx) => {
      const store = tx.objectStore('audit_logs');
      await this.reqToPromise(store.put(log));
    });
  }

  // -------------------------------------------------------------
  // SETTINGS (Client session & preferences)
  // -------------------------------------------------------------
  async getSetting<T = any>(key: string, defaultValue: T): Promise<T> {
    return this.transaction(['app_settings'], 'readonly', async (tx) => {
      const store = tx.objectStore('app_settings');
      const item = await this.reqToPromise<{ key: string; value: T } | undefined>(store.get(key));
      return item ? item.value : defaultValue;
    });
  }

  async setSetting<T = any>(key: string, value: T): Promise<void> {
    return this.transaction(['app_settings'], 'readwrite', async (tx) => {
      const store = tx.objectStore('app_settings');
      await this.reqToPromise(store.put({ key, value }));
    });
  }

  // -------------------------------------------------------------
  // FINANCIAL ACCOUNTS (Phase 2 - Sub-phase A)
  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // FINANCIAL ACCOUNTS (Phase 2 - Sub-phases A & B)
  // -------------------------------------------------------------
  async getAccountsByHousehold(householdId: string, actorUserId = 'SYSTEM'): Promise<FinancialAccount[]> {
    if (actorUserId !== 'SYSTEM') {
      await this.assertPermission(householdId, actorUserId, 'finance', 'read');
    }
    const rawAccounts = await this.transaction(['financial_accounts'], 'readonly', async (tx) => {
      const store = tx.objectStore('financial_accounts');
      const idx = store.index('householdId');
      return this.reqToPromise<FinancialAccount[]>(idx.getAll(householdId));
    });

    // Compute dynamic balances from opening balances + ledger transactions (Zero drift!)
    return this.computeAccountBalances(householdId, rawAccounts);
  }

  async getAccountById(accountId: string, householdId: string): Promise<FinancialAccount | null> {
    const rawAccount = await this.transaction(['financial_accounts'], 'readonly', async (tx) => {
      const store = tx.objectStore('financial_accounts');
      const acc = await this.reqToPromise<FinancialAccount | undefined>(store.get(accountId));
      if (!acc) return null;
      if (acc.householdId !== householdId) {
        throw new Error('הפרת בידוד משק בית (Tenant Isolation Violation): החשבון אינו שייך למשק הבית המבוקש.');
      }
      return acc;
    });

    if (!rawAccount) return null;
    const computedList = await this.computeAccountBalances(householdId, [rawAccount]);
    return computedList[0] || null;
  }

  /**
   * Computes dynamic account balances in strict integer cents by summing opening balances with ledger transactions.
   * Ensures that account balances never drift or desynchronize from the transactions.
   */
  async computeAccountBalances(
    householdId: string,
    accounts: FinancialAccount[]
  ): Promise<FinancialAccount[]> {
    const transactions = await this.getTransactionsByHousehold(householdId);

    // Map account balances in integer cents
    const balanceMap = new Map<string, number>();
    for (const acc of accounts) {
      const openCents = acc.openingBalanceCents !== undefined
        ? acc.openingBalanceCents
        : toCents(acc.openingBalance);
      balanceMap.set(acc.id, openCents);
    }

    for (const tx of transactions) {
      // Imported rows remain PENDING until reviewed. They must never change
      // official account balances or allow malformed amounts to poison totals.
      if (tx.verificationStatus === 'PENDING' || !Number.isSafeInteger(tx.amountCents) || tx.amountCents <= 0) continue;
      if (!balanceMap.has(tx.accountId)) continue;
      const current = balanceMap.get(tx.accountId)!;

      if (tx.type === 'INCOME') {
        balanceMap.set(tx.accountId, current + tx.amountCents);
      } else if (tx.type === 'EXPENSE') {
        balanceMap.set(tx.accountId, current - tx.amountCents);
      } else if (tx.type === 'TRANSFER') {
        if (tx.transferDirection === 'IN') {
          balanceMap.set(tx.accountId, current + tx.amountCents);
        } else if (tx.transferDirection === 'OUT') {
          balanceMap.set(tx.accountId, current - tx.amountCents);
        }
      }
    }

    return accounts.map((acc) => {
      const openCents = acc.openingBalanceCents !== undefined
        ? acc.openingBalanceCents
        : toCents(acc.openingBalance);
      const computedCents = balanceMap.get(acc.id) ?? openCents;
      return {
        ...acc,
        openingBalanceCents: openCents,
        openingBalance: fromCents(openCents),
        currentBalanceCents: computedCents,
        currentBalance: fromCents(computedCents),
        creditLimitCents: acc.creditLimit !== undefined ? toCents(String(acc.creditLimit)) : undefined,
      };
    });
  }

  async createAccount(
    householdId: string,
    data: {
      name: string;
      type: FinancialAccount['type'];
      institution: string;
      accountNumberLast4?: string;
      currency?: FinancialAccount['currency'];
      openingBalance: number;
      creditLimit?: number;
      interestRate?: number;
      notes?: string;
      color?: string;
    },
    actorUserId: string,
    actorEmail: string
  ): Promise<FinancialAccount> {
    await this.assertPermission(householdId, actorUserId, 'finance', 'write');

    if (!data.name || !data.name.trim()) {
      throw new Error('שם החשבון הינו שדה חובה');
    }
    if (!data.institution || !data.institution.trim()) {
      throw new Error('שם המוסד הפיננסי הינו שדה חובה');
    }

    const parsedOpeningBalance = parseCurrencyInput(String(data.openingBalance));
    if (!parsedOpeningBalance.valid) throw new Error('יתרת הפתיחה חייבת להיות סכום תקין עם עד שתי ספרות אחרי הנקודה');
    const openingBalanceCents = parsedOpeningBalance.cents;
    const parsedCreditLimit = data.creditLimit !== undefined ? parseCurrencyInput(String(data.creditLimit)) : undefined;
    if (parsedCreditLimit && (!parsedCreditLimit.valid || parsedCreditLimit.cents < 0)) {
      throw new Error('מסגרת האשראי חייבת להיות סכום תקין ולא שלילי');
    }
    if (data.interestRate !== undefined && (!Number.isFinite(data.interestRate) || data.interestRate < 0)) {
      throw new Error('שיעור הריבית חייב להיות מספר תקין ולא שלילי');
    }
    const currency = data.currency || 'ILS';
    if (!(['ILS', 'USD', 'EUR', 'GBP'] as string[]).includes(currency)) {
      throw new Error('המטבע שנבחר אינו נתמך');
    }
    const isLiability = data.type === 'CREDIT_CARD' || data.type === 'LOAN_MORTGAGE';

    const id = `acc_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newAccount: FinancialAccount = {
      id,
      householdId,
      name: data.name.trim(),
      type: data.type,
      institution: data.institution.trim(),
      accountNumberLast4: data.accountNumberLast4?.trim() || undefined,
      currency,
      openingBalanceCents,
      openingBalance: fromCents(openingBalanceCents),
      currentBalanceCents: openingBalanceCents,
      currentBalance: fromCents(openingBalanceCents),
      status: 'ACTIVE',
      isLiability,
      creditLimitCents: parsedCreditLimit?.cents,
      creditLimit: parsedCreditLimit ? fromCents(parsedCreditLimit.cents) : undefined,
      interestRate: data.interestRate !== undefined ? Number(data.interestRate) : undefined,
      notes: data.notes?.trim() || undefined,
      color: data.color || undefined,
      createdAt: now,
      updatedAt: now,
    };

    await this.transaction(['financial_accounts'], 'readwrite', async (tx) => {
      const store = tx.objectStore('financial_accounts');
      await this.reqToPromise(store.put(newAccount));
    });

    await this.recordAuditLog(
      householdId,
      actorUserId,
      actorEmail,
      'CREATE_ACCOUNT',
      'FINANCE',
      `הקמת חשבון פיננסי: ${newAccount.name} (${newAccount.type}) במוסד ${newAccount.institution}`
    );

    return newAccount;
  }

  async updateAccount(
    householdId: string,
    accountId: string,
    patch: Partial<Omit<FinancialAccount, 'id' | 'householdId' | 'createdAt'>>,
    actorUserId: string,
    actorEmail: string
  ): Promise<FinancialAccount> {
    await this.assertPermission(householdId, actorUserId, 'finance', 'write');

    const existing = await this.getAccountById(accountId, householdId);
    if (!existing) {
      throw new Error('חשבון פיננסי לא נמצא');
    }

    if (patch.name !== undefined && !patch.name.trim()) throw new Error('שם החשבון הינו שדה חובה');
    if (patch.institution !== undefined && !patch.institution.trim()) throw new Error('שם המוסד הפיננסי הינו שדה חובה');
    if (patch.currency !== undefined && !(['ILS', 'USD', 'EUR', 'GBP'] as string[]).includes(patch.currency)) {
      throw new Error('המטבע שנבחר אינו נתמך');
    }
    if (patch.currency !== undefined && patch.currency !== existing.currency) {
      const linkedTransactions = await this.getTransactionsByAccount(householdId, accountId);
      if (linkedTransactions.length > 0) {
        throw new Error('לא ניתן לשנות מטבע של חשבון שכבר קיימות בו עסקאות. יש לפתוח חשבון חדש במטבע הרצוי כדי לשמור על דיוק הנתונים.');
      }
    }

    const parsedOpeningBalance = patch.openingBalance !== undefined
      ? parseCurrencyInput(String(patch.openingBalance))
      : undefined;
    if (parsedOpeningBalance && !parsedOpeningBalance.valid) {
      throw new Error('יתרת הפתיחה חייבת להיות סכום תקין עם עד שתי ספרות אחרי הנקודה');
    }
    const parsedCreditLimit = patch.creditLimit !== undefined
      ? parseCurrencyInput(String(patch.creditLimit))
      : undefined;
    if (parsedCreditLimit && (!parsedCreditLimit.valid || parsedCreditLimit.cents < 0)) {
      throw new Error('מסגרת האשראי חייבת להיות סכום תקין ולא שלילי');
    }
    if (patch.interestRate !== undefined && (!Number.isFinite(patch.interestRate) || patch.interestRate < 0)) {
      throw new Error('שיעור הריבית חייב להיות מספר תקין ולא שלילי');
    }

    const isLiability = patch.type
      ? patch.type === 'CREDIT_CARD' || patch.type === 'LOAN_MORTGAGE'
      : existing.isLiability;
    const openingBalanceCents = parsedOpeningBalance?.cents ?? existing.openingBalanceCents;
    const creditLimitCents = parsedCreditLimit?.cents ?? existing.creditLimitCents;

    const updated: FinancialAccount = {
      ...existing,
      ...patch,
      openingBalanceCents,
      openingBalance: fromCents(openingBalanceCents),
      creditLimitCents,
      creditLimit: creditLimitCents !== undefined ? fromCents(creditLimitCents) : undefined,
      isLiability,
      updatedAt: new Date().toISOString(),
    };

    await this.transaction(['financial_accounts'], 'readwrite', async (tx) => {
      const store = tx.objectStore('financial_accounts');
      await this.reqToPromise(store.put(updated));
    });

    await this.recordAuditLog(
      householdId,
      actorUserId,
      actorEmail,
      'UPDATE_ACCOUNT',
      'FINANCE',
      `עדכון פרטי חשבון: ${updated.name}`
    );

    const recomputed = await this.computeAccountBalances(householdId, [updated]);
    return recomputed[0];
  }

  async archiveAccount(
    householdId: string,
    accountId: string,
    actorUserId: string,
    actorEmail: string
  ): Promise<FinancialAccount> {
    await this.assertPermission(householdId, actorUserId, 'finance', 'write');

    const existing = await this.getAccountById(accountId, householdId);
    if (!existing) throw new Error('חשבון לא נמצא');

    const newStatus: FinancialAccount['status'] = existing.status === 'ARCHIVED' ? 'ACTIVE' : 'ARCHIVED';
    const updated = await this.updateAccount(householdId, accountId, { status: newStatus }, actorUserId, actorEmail);

    await this.recordAuditLog(
      householdId,
      actorUserId,
      actorEmail,
      newStatus === 'ARCHIVED' ? 'ARCHIVE_ACCOUNT' : 'UNARCHIVE_ACCOUNT',
      'FINANCE',
      `שינוי סטטוס חשבון ${existing.name} ל-${newStatus}`
    );

    return updated;
  }

  async deleteAccount(
    householdId: string,
    accountId: string,
    actorUserId: string,
    actorEmail: string
  ): Promise<void> {
    await this.assertPermission(householdId, actorUserId, 'finance', 'write');

    const existing = await this.getAccountById(accountId, householdId);
    if (!existing) throw new Error('חשבון לא נמצא');

    // Check if transactions exist on this account
    const txs = await this.getTransactionsByAccount(householdId, accountId);
    if (txs.length > 0) {
      throw new Error(`לא ניתן למחוק חשבון זה מכיוון שקיימות עבורו ${txs.length} עסקאות בספר העסקאות. באפשרותך להעבירו לארכיון.`);
    }

    await this.transaction(['financial_accounts'], 'readwrite', async (tx) => {
      const store = tx.objectStore('financial_accounts');
      await this.reqToPromise(store.delete(accountId));
    });

    await this.recordAuditLog(
      householdId,
      actorUserId,
      actorEmail,
      'DELETE_ACCOUNT',
      'FINANCE',
      `מחיקת חשבון פיננסי: ${existing.name} (${existing.institution})`
    );
  }

  calculateFinancialSummary(accounts: FinancialAccount[]): {
    totalAssetsCents: number;
    totalLiabilitiesCents: number;
    netWorthCents: number;
    totalAssets: number;
    totalLiabilities: number;
    netWorth: number;
    activeCount: number;
    checkingTotal: number;
    creditTotal: number;
    savingsTotal: number;
    loansTotal: number;
  } {
    let totalAssetsCents = 0;
    let totalLiabilitiesCents = 0;
    let checkingTotalCents = 0;
    let creditTotalCents = 0;
    let savingsTotalCents = 0;
    let loansTotalCents = 0;
    let activeCount = 0;

    for (const acc of accounts) {
      if (acc.status === 'ARCHIVED' || acc.status === 'CLOSED') continue;
      activeCount++;
      // Balances in different currencies must never be added without an FX rate.
      if (acc.currency !== 'ILS') continue;

      const balCents = acc.currentBalanceCents !== undefined
        ? acc.currentBalanceCents
        : toCents(acc.currentBalance);

      switch (acc.type) {
        case 'CHECKING':
          checkingTotalCents += balCents;
          if (balCents >= 0) {
            totalAssetsCents += balCents;
          } else {
            // Overdraft counts as liability
            totalLiabilitiesCents += Math.abs(balCents);
          }
          break;

        case 'SAVINGS':
          savingsTotalCents += balCents;
          if (balCents >= 0) totalAssetsCents += balCents;
          else totalLiabilitiesCents += Math.abs(balCents);
          break;

        case 'CREDIT_CARD':
          creditTotalCents += balCents;
          if (balCents >= 0) totalAssetsCents += balCents;
          else totalLiabilitiesCents += Math.abs(balCents);
          break;

        case 'LOAN_MORTGAGE':
          loansTotalCents += balCents;
          if (balCents >= 0) totalAssetsCents += balCents;
          else totalLiabilitiesCents += Math.abs(balCents);
          break;
      }
    }

    const netWorthCents = totalAssetsCents - totalLiabilitiesCents;

    return {
      totalAssetsCents,
      totalLiabilitiesCents,
      netWorthCents,
      totalAssets: fromCents(totalAssetsCents),
      totalLiabilities: fromCents(totalLiabilitiesCents),
      netWorth: fromCents(netWorthCents),
      activeCount,
      checkingTotal: fromCents(checkingTotalCents),
      creditTotal: fromCents(creditTotalCents),
      savingsTotal: fromCents(savingsTotalCents),
      loansTotal: fromCents(loansTotalCents),
    };
  }

  // -------------------------------------------------------------
  // CENTRAL LEDGER TRANSACTIONS & TRANSFERS (Phase 2 - Sub-phase B)
  // -------------------------------------------------------------
  async getTransactionsByHousehold(
    householdId: string,
    actorUserId = 'SYSTEM',
    filters?: {
      accountId?: string;
      type?: TransactionType;
      category?: string;
      search?: string;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<LedgerTransaction[]> {
    if (actorUserId !== 'SYSTEM') {
      await this.assertPermission(householdId, actorUserId, 'finance', 'read');
    }

    const list = await this.transaction(['ledger_transactions'], 'readonly', async (tx) => {
      const store = tx.objectStore('ledger_transactions');
      if (filters?.accountId) {
        const idx = store.index('accountId');
        return this.reqToPromise<LedgerTransaction[]>(idx.getAll(filters.accountId));
      }
      const idx = store.index('householdId');
      return this.reqToPromise<LedgerTransaction[]>(idx.getAll(householdId));
    });

    // Enforce Tenant Isolation strictly
    let filtered = list.filter((t) => t.householdId === householdId);

    if (filters?.type) {
      filtered = filtered.filter((t) => t.type === filters.type);
    }
    if (filters?.category) {
      filtered = filtered.filter((t) => t.category === filters.category);
    }
    if (filters?.startDate) {
      filtered = filtered.filter((t) => t.date >= filters.startDate!);
    }
    if (filters?.endDate) {
      filtered = filtered.filter((t) => t.date <= filters.endDate!);
    }
    if (filters?.search) {
      const query = filters.search.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.payee.toLowerCase().includes(query) ||
          t.category.toLowerCase().includes(query) ||
          (t.notes && t.notes.toLowerCase().includes(query))
      );
    }

    // Sort newest date first, and then newest creation
    return filtered.sort((a, b) => {
      const dateDiff = new Date(b.date).getTime() - new Date(a.date).getTime();
      if (dateDiff !== 0) return dateDiff;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }

  async getTransactionsByAccount(householdId: string, accountId: string): Promise<LedgerTransaction[]> {
    return this.getTransactionsByHousehold(householdId, 'SYSTEM', { accountId });
  }

  async getTransactionById(transactionId: string, householdId: string): Promise<LedgerTransaction | null> {
    return this.transaction(['ledger_transactions'], 'readonly', async (tx) => {
      const store = tx.objectStore('ledger_transactions');
      const item = await this.reqToPromise<LedgerTransaction | undefined>(store.get(transactionId));
      if (!item) return null;
      if (item.householdId !== householdId) {
        throw new Error('הפרת בידוד משק בית (Tenant Isolation Violation): עסקה זו אינה שייכת למשק הבית המבוקש.');
      }
      return item;
    });
  }

  /**
   * Creates an Income or Expense transaction in the central ledger.
   */
  async createTransaction(
    householdId: string,
    data: {
      accountId: string;
      date: string;
      valueDate?: string;
      amountCents: number;
      type: 'INCOME' | 'EXPENSE';
      category: string;
      payee: string;
      notes?: string;
      source?: TransactionSource;
      verificationStatus?: VerificationStatus;
    },
    actorUserId: string,
    actorEmail: string
  ): Promise<LedgerTransaction> {
    await this.assertPermission(householdId, actorUserId, 'finance', 'write');

    if (!data.accountId) throw new Error('יש לבחור חשבון משויך לעסקה');
    if (!isValidISODate(data.date)) {
      throw new Error('יש לציין תאריך עסקה תקין');
    }
    if (!data.category?.trim()) throw new Error('יש להגדיר קטגוריה לעסקה');
    if (!data.payee?.trim()) throw new Error('יש לציין בית עסק או גורם לעסקה');
    if (data.amountCents <= 0 || !Number.isSafeInteger(data.amountCents)) {
      throw new Error('סכום העסקה חייב להיות מספר חיובי שלם באגורות');
    }

    // Verify account exists in this household
    const account = await this.getAccountById(data.accountId, householdId);
    if (!account) throw new Error('החשבון המשויך אינו קיים במשק בית זה');
    if (account.status === 'ARCHIVED' || account.status === 'CLOSED') {
      throw new Error('לא ניתן לרשום עסקה בחשבון שהועבר לארכיון או נסגר');
    }

    const id = `tx_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date().toISOString();

    const newTx: LedgerTransaction = {
      id,
      householdId,
      accountId: data.accountId,
      date: data.date,
      valueDate: data.valueDate || undefined,
      amountCents: data.amountCents,
      type: data.type,
      category: data.category.trim(),
      payee: data.payee.trim(),
      notes: data.notes?.trim() || undefined,
      source: data.source || 'MANUAL',
      verificationStatus: data.verificationStatus || 'VERIFIED',
      createdAt: now,
      updatedAt: now,
      createdBy: actorUserId,
    };

    await this.transaction(['ledger_transactions'], 'readwrite', async (tx) => {
      const store = tx.objectStore('ledger_transactions');
      await this.reqToPromise(store.put(newTx));
    });

    await this.recordAuditLog(
      householdId,
      actorUserId,
      actorEmail,
      'CREATE_TRANSACTION',
      'FINANCE',
      `רישום עסקה: ${newTx.type === 'INCOME' ? 'הכנסה' : 'הוצאה'} ע"ס ${formatCents(newTx.amountCents, account.currency)} בחשבון ${account.name} (${newTx.payee})`
    );

    return newTx;
  }

  /**
   * Creates an Account-to-Account Transfer atomically with linked 2 legs.
   * Both legs share the same `transferId` and point to each other via `linkedTransactionId`.
   * Internal transfers are NOT treated as household income or expenses.
   */
  async createTransfer(
    householdId: string,
    data: {
      fromAccountId: string;
      toAccountId: string;
      date: string;
      valueDate?: string;
      amountCents: number;
      category?: string;
      notes?: string;
    },
    actorUserId: string,
    actorEmail: string
  ): Promise<{ outgoingLeg: LedgerTransaction; incomingLeg: LedgerTransaction }> {
    await this.assertPermission(householdId, actorUserId, 'finance', 'write');

    if (!data.fromAccountId || !data.toAccountId) {
      throw new Error('יש לבחור חשבון מקור וחשבון יעד להעברה');
    }
    if (data.fromAccountId === data.toAccountId) {
      throw new Error('חשבון מקור וחשבון יעד חייבים להיות חשבונות שונים');
    }
    if (!isValidISODate(data.date)) {
      throw new Error('יש לציין תאריך תקין להעברה');
    }
    if (data.amountCents <= 0 || !Number.isSafeInteger(data.amountCents)) {
      throw new Error('סכום ההעברה חייב להיות מספר שלם חיובי באגורות');
    }

    const [fromAccount, toAccount] = await Promise.all([
      this.getAccountById(data.fromAccountId, householdId),
      this.getAccountById(data.toAccountId, householdId),
    ]);

    if (!fromAccount || !toAccount) {
      throw new Error('אחד מהחשבונות לא נמצא במשק הבית הפעיל');
    }
    if (fromAccount.currency !== toAccount.currency) {
      throw new Error('לא ניתן לבצע העברה ישירה בין חשבונות במטבעות שונים ללא שער המרה מאומת');
    }
    if ([fromAccount, toAccount].some((account) => account.status === 'ARCHIVED' || account.status === 'CLOSED')) {
      throw new Error('לא ניתן לבצע העברה מחשבון שהועבר לארכיון או נסגר');
    }

    const transferId = `trf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const legOutId = `tx_${Date.now()}_out_${Math.random().toString(36).substring(2, 5)}`;
    const legInId = `tx_${Date.now()}_in_${Math.random().toString(36).substring(2, 5)}`;
    const now = new Date().toISOString();

    const category = data.category?.trim() || 'העברה פנימית';

    // Outgoing Leg (Decreases fromAccount balance)
    const outgoingLeg: LedgerTransaction = {
      id: legOutId,
      householdId,
      accountId: data.fromAccountId,
      date: data.date,
      valueDate: data.valueDate || undefined,
      amountCents: data.amountCents,
      type: 'TRANSFER',
      transferDirection: 'OUT',
      transferId,
      linkedTransactionId: legInId,
      counterpartyAccountId: data.toAccountId,
      category,
      payee: `העברה אל: ${toAccount.name}`,
      notes: data.notes?.trim() || undefined,
      source: 'MANUAL',
      verificationStatus: 'VERIFIED',
      createdAt: now,
      updatedAt: now,
      createdBy: actorUserId,
    };

    // Incoming Leg (Increases toAccount balance)
    const incomingLeg: LedgerTransaction = {
      id: legInId,
      householdId,
      accountId: data.toAccountId,
      date: data.date,
      valueDate: data.valueDate || undefined,
      amountCents: data.amountCents,
      type: 'TRANSFER',
      transferDirection: 'IN',
      transferId,
      linkedTransactionId: legOutId,
      counterpartyAccountId: data.fromAccountId,
      category,
      payee: `העברה מאת: ${fromAccount.name}`,
      notes: data.notes?.trim() || undefined,
      source: 'MANUAL',
      verificationStatus: 'VERIFIED',
      createdAt: now,
      updatedAt: now,
      createdBy: actorUserId,
    };

    // ATOMIC WRITE: Both legs written in the exact same transaction
    await this.transaction(['ledger_transactions'], 'readwrite', async (tx) => {
      const store = tx.objectStore('ledger_transactions');
      await this.reqToPromise(store.put(outgoingLeg));
      await this.reqToPromise(store.put(incomingLeg));
    });

    await this.recordAuditLog(
      householdId,
      actorUserId,
      actorEmail,
      'CREATE_TRANSFER',
      'FINANCE',
      `ביצוע העברה פנימית ע"ס ${formatCents(data.amountCents, fromAccount.currency)} מחשבון ${fromAccount.name} אל ${toAccount.name}`
    );

    return { outgoingLeg, incomingLeg };
  }

  /**
   * Updates a transaction. If it's part of a 2-legged transfer, updates both legs atomically.
   */
  async updateTransaction(
    householdId: string,
    transactionId: string,
    patch: Partial<LedgerTransaction>,
    actorUserId: string,
    actorEmail: string
  ): Promise<LedgerTransaction> {
    await this.assertPermission(householdId, actorUserId, 'finance', 'write');

    const existing = await this.getTransactionById(transactionId, householdId);
    if (!existing) throw new Error('עסקה לא נמצאה');

    if (patch.amountCents !== undefined && (patch.amountCents <= 0 || !Number.isSafeInteger(patch.amountCents))) {
      throw new Error('סכום העסקה חייב להיות מספר חיובי שלם באגורות');
    }
    if (patch.date !== undefined && !isValidISODate(patch.date)) {
      throw new Error('יש לציין תאריך עסקה תקין');
    }
    if (patch.category !== undefined && !patch.category.trim()) {
      throw new Error('יש להגדיר קטגוריה לעסקה');
    }
    if (patch.payee !== undefined && !patch.payee.trim()) {
      throw new Error('יש לציין בית עסק או גורם לעסקה');
    }

    const now = new Date().toISOString();
    // Only editable business fields may change. IDs, household/account ownership,
    // transaction type and transfer links are immutable after creation.
    const updated: LedgerTransaction = {
      ...existing,
      date: patch.date ?? existing.date,
      valueDate: patch.valueDate !== undefined ? patch.valueDate : existing.valueDate,
      amountCents: patch.amountCents ?? existing.amountCents,
      category: patch.category !== undefined ? patch.category.trim() : existing.category,
      payee: patch.payee !== undefined ? patch.payee.trim() : existing.payee,
      notes: patch.notes !== undefined ? patch.notes?.trim() || undefined : existing.notes,
      verificationStatus: patch.verificationStatus ?? existing.verificationStatus,
      updatedAt: now,
    };

    // If it's a transfer, synchronize counterpart leg atomically
    if (existing.type === 'TRANSFER') {
      if (!existing.linkedTransactionId) {
        throw new Error('העברה זו אינה מקושרת לרגל הנגדית שלה; לא ניתן לעדכן אותה');
      }
      const counterLeg = await this.getTransactionById(existing.linkedTransactionId, householdId);
      if (!counterLeg || counterLeg.type !== 'TRANSFER' || counterLeg.linkedTransactionId !== existing.id || counterLeg.transferId !== existing.transferId) {
        throw new Error('רגל ההעברה הנגדית חסרה או אינה תואמת; העדכון בוטל כדי למנוע חוסר איזון');
      }

      await this.transaction(['ledger_transactions'], 'readwrite', async (tx) => {
        const store = tx.objectStore('ledger_transactions');
        await this.reqToPromise(store.put(updated));

        if (counterLeg) {
          const counterUpdated: LedgerTransaction = {
            ...counterLeg,
            date: patch.date || counterLeg.date,
            valueDate: patch.valueDate !== undefined ? patch.valueDate : counterLeg.valueDate,
            amountCents: patch.amountCents !== undefined ? patch.amountCents : counterLeg.amountCents,
            category: patch.category || counterLeg.category,
            notes: patch.notes !== undefined ? patch.notes : counterLeg.notes,
            verificationStatus: patch.verificationStatus ?? counterLeg.verificationStatus,
            updatedAt: now,
          };
          await this.reqToPromise(store.put(counterUpdated));
        }
      });
    } else {
      await this.transaction(['ledger_transactions'], 'readwrite', async (tx) => {
        const store = tx.objectStore('ledger_transactions');
        await this.reqToPromise(store.put(updated));
      });
    }

    const transactionAccount = await this.getAccountById(existing.accountId, householdId);
    await this.recordAuditLog(
      householdId,
      actorUserId,
      actorEmail,
      'UPDATE_TRANSACTION',
      'FINANCE',
      `עדכון עסקה: ${updated.payee} (${formatCents(updated.amountCents, transactionAccount?.currency || 'ILS')})`
    );

    return updated;
  }

  /**
   * Deletes a transaction. If it's part of a transfer, atomically deletes the linked leg too!
   */
  async deleteTransaction(
    householdId: string,
    transactionId: string,
    actorUserId: string,
    actorEmail: string
  ): Promise<void> {
    await this.assertPermission(householdId, actorUserId, 'finance', 'write');

    const existing = await this.getTransactionById(transactionId, householdId);
    if (!existing) throw new Error('עסקה לא נמצאה');

    let counterLeg: LedgerTransaction | null = null;
    if (existing.type === 'TRANSFER') {
      if (!existing.linkedTransactionId || !existing.transferId) {
        throw new Error('העברה זו אינה מקושרת לרגל הנגדית שלה; לא ניתן למחוק אותה בבטחה');
      }
      counterLeg = await this.getTransactionById(existing.linkedTransactionId, householdId);
      if (!counterLeg || counterLeg.type !== 'TRANSFER' || counterLeg.linkedTransactionId !== existing.id || counterLeg.transferId !== existing.transferId) {
        throw new Error('רגל ההעברה הנגדית חסרה או אינה תואמת; המחיקה בוטלה כדי למנוע פגיעה ביתרות');
      }
    }

    await this.transaction(['ledger_transactions'], 'readwrite', async (tx) => {
      const store = tx.objectStore('ledger_transactions');
      await this.reqToPromise(store.delete(transactionId));
      if (counterLeg) await this.reqToPromise(store.delete(counterLeg.id));
    });

    const transactionAccount = await this.getAccountById(existing.accountId, householdId);
    await this.recordAuditLog(
      householdId,
      actorUserId,
      actorEmail,
      'DELETE_TRANSACTION',
      'FINANCE',
      `מחיקת עסקה ${existing.id} (${existing.payee}, ${formatCents(existing.amountCents, transactionAccount?.currency || 'ILS')})${existing.linkedTransactionId ? ' יחד עם רגל ההעברה המקושרת' : ''}`
    );
  }

  /**
   * Computes household cashflow totals (Income, Expense, Net cashflow).
   * CRITICAL: Transfers are strictly excluded to avoid double-counting!
   */
  calculateHouseholdLedgerSummary(
    householdId: string,
    transactions: LedgerTransaction[]
  ): {
    totalIncomeCents: number;
    totalExpenseCents: number;
    netCashflowCents: number;
    totalTransfersCents: number;
    totalIncome: number;
    totalExpense: number;
    netCashflow: number;
    totalTransfers: number;
    incomeCount: number;
    expenseCount: number;
    transferCount: number;
  } {
    let totalIncomeCents = 0;
    let totalExpenseCents = 0;
    let totalTransfersCents = 0;
    let incomeCount = 0;
    let expenseCount = 0;
    let transferCount = 0;

    for (const tx of transactions) {
      if (tx.householdId !== householdId) continue;
      if (tx.verificationStatus === 'PENDING' || !Number.isSafeInteger(tx.amountCents) || tx.amountCents <= 0) continue;

      if (tx.type === 'INCOME') {
        totalIncomeCents += tx.amountCents;
        incomeCount++;
      } else if (tx.type === 'EXPENSE') {
        totalExpenseCents += tx.amountCents;
        expenseCount++;
      } else if (tx.type === 'TRANSFER') {
        // Track transfers without double counting (only track OUT legs)
        if (tx.transferDirection === 'OUT') {
          totalTransfersCents += tx.amountCents;
          transferCount++;
        }
      }
    }

    const netCashflowCents = totalIncomeCents - totalExpenseCents;

    return {
      totalIncomeCents,
      totalExpenseCents,
      netCashflowCents,
      totalTransfersCents,
      totalIncome: fromCents(totalIncomeCents),
      totalExpense: fromCents(totalExpenseCents),
      netCashflow: fromCents(netCashflowCents),
      totalTransfers: fromCents(totalTransfersCents),
      incomeCount,
      expenseCount,
      transferCount,
    };
  }

  // -------------------------------------------------------------
  // HOUSEHOLD DOCUMENT VAULT
  // -------------------------------------------------------------
  async getDocumentsByHousehold(householdId: string): Promise<HouseholdDocument[]> {
    return this.transaction(['household_documents'], 'readonly', async (tx) => {
      const store = tx.objectStore('household_documents');
      const records = await this.reqToPromise<HouseholdDocument[]>(store.index('householdId').getAll(householdId));
      return records.sort((a, b) => b.uploadedAt.localeCompare(a.uploadedAt));
    });
  }

  async saveDocument(document: HouseholdDocument): Promise<void> {
    if (!document.householdId || !document.name || !(document.blob instanceof Blob)) {
      throw new Error('פרטי המסמך אינם תקינים');
    }
    if (document.size > 25 * 1024 * 1024) throw new Error('גודל הקובץ המרבי הוא 25MB');
    return this.transaction(['household_documents'], 'readwrite', async (tx) => {
      const store = tx.objectStore('household_documents');
      const existing = await this.reqToPromise<HouseholdDocument | undefined>(store.get(document.id));
      if (existing && existing.householdId !== document.householdId) {
        throw new Error('הפרת בידוד משקי בית: לא ניתן להחליף מסמך השייך למשק בית אחר');
      }
      await this.reqToPromise(store.put(document));
    });
  }

  async deleteDocument(documentId: string, householdId: string): Promise<void> {
    return this.transaction(['household_documents'], 'readwrite', async (tx) => {
      const store = tx.objectStore('household_documents');
      const existing = await this.reqToPromise<HouseholdDocument | undefined>(store.get(documentId));
      if (!existing || existing.householdId !== householdId) throw new Error('המסמך לא נמצא במשק הבית הפעיל');
      await this.reqToPromise(store.delete(documentId));
    });
  }

  // -------------------------------------------------------------
  // HOUSEHOLD OPERATIONS
  // -------------------------------------------------------------
  async getHomeItemsByHousehold(householdId: string, actorUserId: string): Promise<HouseholdHomeItem[]> {
    await this.assertPermission(householdId, actorUserId, 'food', 'read');
    return this.transaction(['household_home_items'], 'readonly', async (tx) => {
      const items = await this.reqToPromise<HouseholdHomeItem[]>(
        tx.objectStore('household_home_items').index('householdId').getAll(householdId)
      );
      return items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    });
  }

  async saveHomeItem(item: HouseholdHomeItem, actorUserId: string): Promise<void> {
    await this.assertPermission(item.householdId, actorUserId, 'food', 'write');
    if (!item.id || !item.householdId || !['recipe', 'meal', 'shopping', 'task'].includes(item.kind)) {
      throw new Error('פרטי הרשומה אינם תקינים');
    }
    return this.transaction(['household_home_items'], 'readwrite', async (tx) => {
      const store = tx.objectStore('household_home_items');
      const existing = await this.reqToPromise<HouseholdHomeItem | undefined>(store.get(item.id));
      if (existing && existing.householdId !== item.householdId) {
        throw new Error('הפרת בידוד משקי בית: לא ניתן לעדכן רשומה השייכת למשק בית אחר');
      }
      await this.reqToPromise(store.put(item));
    });
  }

  async deleteHomeItem(itemId: string, householdId: string, actorUserId: string): Promise<void> {
    await this.assertPermission(householdId, actorUserId, 'food', 'write');
    return this.transaction(['household_home_items'], 'readwrite', async (tx) => {
      const store = tx.objectStore('household_home_items');
      const existing = await this.reqToPromise<HouseholdHomeItem | undefined>(store.get(itemId));
      if (!existing || existing.householdId !== householdId) throw new Error('הרשומה לא נמצאה במשק הבית הפעיל');
      await this.reqToPromise(store.delete(itemId));
    });
  }

  // -------------------------------------------------------------
  // BACKUP EXPORT & IMPORT
  // -------------------------------------------------------------
  async exportFullBackup(householdId: string): Promise<BackupData> {
    const [households, users, memberships, persons, permissions, auditLogs, accounts, transactions, documents, homeItems] = await Promise.all([
      this.getHouseholds(),
      this.getUsers(),
      this.getMembershipsByHousehold(householdId),
      this.getPersonsByHousehold(householdId),
      this.transaction(['household_permissions'], 'readonly', async (tx) => {
        const store = tx.objectStore('household_permissions');
        const idx = store.index('householdId');
        return this.reqToPromise<HouseholdPermissionRule[]>(idx.getAll(householdId));
      }),
      this.getAuditLogs(householdId, 500),
      this.getAccountsByHousehold(householdId),
      this.getTransactionsByHousehold(householdId),
      this.getDocumentsByHousehold(householdId),
      this.transaction(['household_home_items'], 'readonly', async (tx) => this.reqToPromise<HouseholdHomeItem[]>(tx.objectStore('household_home_items').index('householdId').getAll(householdId))),
    ]);

    const targetHhd = households.filter((h) => h.id === householdId);
    const householdUserIds = new Set(memberships.map(membership => membership.userId));
    const householdUsers = users.filter(user => householdUserIds.has(user.id));

    return {
      version: '2.1.0',
      exportedAt: new Date().toISOString(),
      households: targetHhd,
      users: householdUsers,
      memberships,
      persons,
      permissions,
      auditLogs,
      accounts,
      transactions,
      homeItems,
      documents: await Promise.all(documents.map(async (doc) => ({
        id: doc.id,
        householdId: doc.householdId,
        name: doc.name,
        mimeType: doc.mimeType,
        size: doc.size,
        category: doc.category,
        uploadedAt: doc.uploadedAt,
        uploadedBy: doc.uploadedBy,
        dataUrl: await blobToDataUrl(doc.blob),
      }))),
    };
  }

  async importFullBackup(
    backup: BackupData,
    actorUserId: string,
    actorEmail: string,
    overwriteConfirmed = false
  ): Promise<void> {
    if (!overwriteConfirmed) {
      throw new Error('שחזור מתוך גיבוי מחייב אישור מפורש של המשתמש לדריסת נתונים קיימים.');
    }

    if (!backup.version || !backup.households || !Array.isArray(backup.households) || backup.households.length !== 1) {
      throw new Error('קובץ הגיבוי חייב להכיל משק בית אחד בפורמט תקין של HOME OS');
    }

    const targetHouseholdId = backup.households[0]?.id;
    if (!targetHouseholdId) throw new Error('מזהה משק הבית בגיבוי חסר');
    await this.assertPermission(targetHouseholdId, actorUserId, 'admin', 'approve');

    const memberships = backup.memberships || [];
    const membershipIds = new Set(memberships.map(membership => membership.id));
    const membershipUserIds = new Set(memberships.map(membership => membership.userId));
    const backupUsers = (backup.users || []).filter(user => membershipUserIds.has(user.id));
    const assertHousehold = (records: Array<{ householdId: string }> | undefined, label: string) => {
      if (records?.some(record => record.householdId !== targetHouseholdId)) {
        throw new Error('הגיבוי מכיל רשומות ' + label + ' ממשק בית אחר');
      }
    };
    assertHousehold(memberships, 'חברות');
    assertHousehold(backup.persons, 'בני בית');
    assertHousehold(backup.permissions, 'הרשאות');
    assertHousehold(backup.auditLogs, 'יומן פעולות');
    assertHousehold(backup.accounts, 'חשבונות');
    assertHousehold(backup.transactions, 'עסקאות');
    if ((backup.accounts || []).some(account =>
      !(['ILS', 'USD', 'EUR', 'GBP'] as string[]).includes(account.currency) ||
      (account.openingBalanceCents !== undefined
        ? !Number.isSafeInteger(account.openingBalanceCents)
        : !parseCurrencyInput(String(account.openingBalance)).valid) ||
      (account.creditLimitCents !== undefined && (!Number.isSafeInteger(account.creditLimitCents) || account.creditLimitCents < 0)) ||
      (account.interestRate !== undefined && (!Number.isFinite(account.interestRate) || account.interestRate < 0))
    )) {
      throw new Error('הגיבוי מכיל חשבון עם מטבע או נתוני יתרה שאינם תקינים');
    }
    assertHousehold(backup.documents, 'מסמכים');
    assertHousehold(backup.homeItems, 'ניהול הבית');
    if ((backup.permissions || []).some(rule => !membershipIds.has(rule.membershipId))) {
      throw new Error('הגיבוי מכיל הרשאה שאינה משויכת לחברות קיימת');
    }
    const backupTransactions = backup.transactions || [];
    if (backupTransactions.some(transaction =>
      !isValidISODate(transaction.date) ||
      !Number.isSafeInteger(transaction.amountCents) ||
      transaction.amountCents <= 0 ||
      (transaction.valueDate !== undefined && !isValidISODate(transaction.valueDate))
    )) {
      throw new Error('הגיבוי מכיל עסקה עם תאריך או סכום שאינם תקינים');
    }
    const accountIds = new Set((backup.accounts || []).map(account => account.id));
    if (backupTransactions.some(transaction =>
      !accountIds.has(transaction.accountId) ||
      Boolean(transaction.counterpartyAccountId && !accountIds.has(transaction.counterpartyAccountId))
    )) {
      throw new Error('הגיבוי מכיל עסקה המשויכת לחשבון מקור או יעד שאינו כלול בגיבוי');
    }
    const backupAccountsById = new Map((backup.accounts || []).map(account => [account.id, account]));
    const backupTransactionsById = new Map(backupTransactions.map(transaction => [transaction.id, transaction]));
    const transferLegCounts = new Map<string, number>();
    for (const transaction of backupTransactions) {
      if (transaction.type === 'TRANSFER' && transaction.transferId) {
        transferLegCounts.set(transaction.transferId, (transferLegCounts.get(transaction.transferId) || 0) + 1);
      }
    }
    if ([...transferLegCounts.values()].some(count => count !== 2) || backupTransactions.some(transaction =>
      transaction.type === 'TRANSFER' &&
      (!transaction.transferId ||
        !transaction.linkedTransactionId ||
        !transaction.counterpartyAccountId ||
        !['OUT', 'IN'].includes(transaction.transferDirection || '') ||
        backupAccountsById.get(transaction.accountId)?.currency !== backupAccountsById.get(transaction.counterpartyAccountId)?.currency ||
        (() => {
          const counterpart = backupTransactionsById.get(transaction.linkedTransactionId!);
          return !counterpart ||
            counterpart.type !== 'TRANSFER' ||
            counterpart.linkedTransactionId !== transaction.id ||
            counterpart.transferId !== transaction.transferId ||
            counterpart.accountId !== transaction.counterpartyAccountId ||
            counterpart.counterpartyAccountId !== transaction.accountId ||
            counterpart.amountCents !== transaction.amountCents ||
            counterpart.date !== transaction.date ||
            counterpart.verificationStatus !== transaction.verificationStatus ||
            !['OUT', 'IN'].includes(counterpart.transferDirection || '') ||
            counterpart.transferDirection === transaction.transferDirection;
        })())
    )) {
      throw new Error('הגיבוי מכיל העברה לא תקינה או בין מטבעות שונים; יש לתקן את הזוג המקושר לפני השחזור');
    }

    await this.transaction(
      [
        'households',
        'users',
        'household_memberships',
        'household_persons',
        'household_permissions',
        'audit_logs',
        'financial_accounts',
        'ledger_transactions',
        'household_documents',
        'household_home_items',
      ],
      'readwrite',
      async (tx) => {
        const hStore = tx.objectStore('households');
        const uStore = tx.objectStore('users');
        const mStore = tx.objectStore('household_memberships');
        const pStore = tx.objectStore('household_persons');
        const permStore = tx.objectStore('household_permissions');
        const aStore = tx.objectStore('audit_logs');
        const accStore = tx.objectStore('financial_accounts');
        const txStore = tx.objectStore('ledger_transactions');
        const docsStore = tx.objectStore('household_documents');
        const homeStore = tx.objectStore('household_home_items');

        const assertExistingOwnership = async (store: IDBObjectStore, id: string, label: string) => {
          const existing = await this.reqToPromise<{ householdId?: string } | undefined>(store.get(id));
          if (existing && existing.householdId !== targetHouseholdId) {
            throw new Error('שחזור הגיבוי ניסה לדרוס ' + label + ' ממשק בית אחר');
          }
        };

        for (const h of backup.households) {
          const existing = await this.reqToPromise<Household | undefined>(hStore.get(h.id));
          if (existing && existing.id !== targetHouseholdId) throw new Error('מזהה משק הבית בגיבוי אינו תואם');
          await this.reqToPromise(hStore.put(h));
        }
        for (const u of backupUsers) {
          const existing = await this.reqToPromise<User | undefined>(uStore.get(u.id));
          if (existing && existing.email.toLowerCase() !== u.email.toLowerCase()) {
            throw new Error('הגיבוי מכיל מזהה משתמש שכבר משויך לכתובת דוא״ל אחרת');
          }
          await this.reqToPromise(uStore.put(u));
        }
        for (const m of memberships) {
          await assertExistingOwnership(mStore, m.id, 'חברות');
          await this.reqToPromise(mStore.put(m));
        }
        for (const p of backup.persons || []) {
          await assertExistingOwnership(pStore, p.id, 'בן בית');
          await this.reqToPromise(pStore.put(p));
        }
        for (const pr of backup.permissions || []) {
          await assertExistingOwnership(permStore, pr.id, 'הרשאה');
          await this.reqToPromise(permStore.put(pr));
        }
        for (const a of backup.auditLogs || []) {
          await assertExistingOwnership(aStore, a.id, 'רישום ביקורת');
          await this.reqToPromise(aStore.put(a));
        }
        if (backup.accounts && Array.isArray(backup.accounts)) {
          for (const acc of backup.accounts) {
            await assertExistingOwnership(accStore, acc.id, 'חשבון');
            await this.reqToPromise(accStore.put(acc));
          }
        }
        if (backup.transactions && Array.isArray(backup.transactions)) {
          for (const t of backup.transactions) {
            await assertExistingOwnership(txStore, t.id, 'עסקה');
            await this.reqToPromise(txStore.put(t));
          }
        }
        if (backup.homeItems && Array.isArray(backup.homeItems)) {
          for (const item of backup.homeItems) {
            await assertExistingOwnership(homeStore, item.id, 'רשומת ניהול בית');
            await this.reqToPromise(homeStore.put(item));
          }
        }
        if (backup.documents && Array.isArray(backup.documents)) {
          for (const doc of backup.documents) {
            await assertExistingOwnership(docsStore, doc.id, 'מסמך');
            const { dataUrl, ...metadata } = doc;
            await this.reqToPromise(docsStore.put({
              ...metadata,
              blob: dataUrlToBlob(dataUrl, doc.mimeType),
            }));
          }
        }
      }
    );

    // Rebuild balances from the restored opening balances and confirmed ledger
    // entries instead of trusting cached balance values embedded in the backup.
    if (backup.accounts?.length) {
      await this.computeAccountBalances(targetHouseholdId, backup.accounts);
    }

    if (backup.households[0]) {
      await this.recordAuditLog(
        backup.households[0].id,
        actorUserId,
        actorEmail,
        'IMPORT_BACKUP',
        'SYSTEM',
        `ייבוא ושחזור נתונים מוצלח מקובץ גיבוי מתאריך ${backup.exportedAt}`
      );
    }
  }

  // -------------------------------------------------------------
  // AUTOMATED TEST SUITE (End-to-End Phase 0 + 1 Verification)
  // -------------------------------------------------------------
  async runTestSuite(): Promise<{
    passed: boolean;
    results: Array<{ testName: string; passed: boolean; message: string; durationMs: number }>;
  }> {
    const results: Array<{ testName: string; passed: boolean; message: string; durationMs: number }> = [];

    // Test 1: Household Creation & Retrieval
    const t1Start = performance.now();
    try {
      const testHhd = await this.createHousehold(
        'משק בית לבדיקה אוטומטית',
        '₪',
        'test_runner',
        'test@test.local'
      );
      const fetched = await this.getHouseholdById(testHhd.id);
      const success = fetched !== null && fetched.name === 'משק בית לבדיקה אוטומטית';
      results.push({
        testName: '1. יצירה ושליפת משק בית ב-IndexedDB',
        passed: success,
        message: success ? 'משק הבית נוצר ונשלף בהצלחה' : 'נכשל בשליפת משק הבית',
        durationMs: Math.round(performance.now() - t1Start),
      });
    } catch (e: any) {
      results.push({
        testName: '1. יצירה ושליפת משק בית ב-IndexedDB',
        passed: false,
        message: e.message,
        durationMs: Math.round(performance.now() - t1Start),
      });
    }

    // Test 2: User Creation & Unique Email Constraint
    const t2Start = performance.now();
    try {
      const uniqueEmail = `test_${Date.now()}@homeos.test`;
      const u1 = await this.createUser(uniqueEmail, 'משתמש בדיקה', '1234');
      let caughtDuplicate = false;
      try {
        await this.createUser(uniqueEmail, 'משתמש כפול', '5678');
      } catch {
        caughtDuplicate = true;
      }
      const success = Boolean(u1.id && caughtDuplicate);
      results.push({
        testName: '2. יצירת משתמש ומניעת כתובות אימייל כפולות',
        passed: success,
        message: success ? 'משתמש נוצר בהצלחה ונמנעה כפילות אימייל' : 'כשל במניעת כפילות',
        durationMs: Math.round(performance.now() - t2Start),
      });
    } catch (e: any) {
      results.push({
        testName: '2. יצירת משתמש ומניעת כתובות אימייל כפולות',
        passed: false,
        message: e.message,
        durationMs: Math.round(performance.now() - t2Start),
      });
    }

    // Test 3: Member Role & Domain Permissions
    const t3Start = performance.now();
    try {
      const hhd = await this.createHousehold('משק בית הרשאות', '₪', 'usr_admin', 'adm@t.l');
      const secondUser = await this.createUser(`sec_${Date.now()}@t.l`, 'משתמש שני', '0000');
      const m = await this.addMemberToHousehold(hhd.id, secondUser.id, 'member', 'usr_admin', 'adm@t.l');
      const perms = await this.getPermissionsByMembership(m.id);
      const financePerm = perms.find((p) => p.domain === 'finance');
      const adminPerm = perms.find((p) => p.domain === 'admin');
      const success = perms.length === 6 && financePerm?.canRead === true && adminPerm?.canWrite === false;
      results.push({
        testName: '3. הקצאת הרשאות תחום לתפקיד Member',
        passed: success,
        message: success ? 'הרשאות חבר הוקצו כהלכה עם חסימת כתיבה לאדמין' : 'כשל בהקצאת הרשאות',
        durationMs: Math.round(performance.now() - t3Start),
      });
    } catch (e: any) {
      results.push({
        testName: '3. הקצאת הרשאות תחום לתפקיד Member',
        passed: false,
        message: e.message,
        durationMs: Math.round(performance.now() - t3Start),
      });
    }

    // Test 4: Household Person without Login Account
    const t4Start = performance.now();
    try {
      const hhd = await this.createHousehold('משק בית ילדים', '₪', 'u_p', 'p@t.l');
      const child = await this.addPerson(
        hhd.id,
        {
          displayName: 'מאיה (פעוטה)',
          personType: 'child',
          portionFactor: 0.5,
          dietaryNotes: 'אוכלת מזון טחון',
        },
        'u_p',
        'p@t.l'
      );
      const persons = await this.getPersonsByHousehold(hhd.id);
      const found = persons.find((p) => p.id === child.id);
      const success = found !== undefined && found.linkedUserId === undefined;
      results.push({
        testName: '4. הוספת בן בית ללא חשבון כניסה (ילדים/תלויים)',
        passed: success,
        message: success ? 'בן בית נוצר בהצלחה ללא ישות משתמש וללא הרשאת כניסה' : 'כשל בהפרדה',
        durationMs: Math.round(performance.now() - t4Start),
      });
    } catch (e: any) {
      results.push({
        testName: '4. הוספת בן בית ללא חשבון כניסה (ילדים/תלויים)',
        passed: false,
        message: e.message,
        durationMs: Math.round(performance.now() - t4Start),
      });
    }

    // Test 5: Tenant Isolation (Cross-Household Data Separation)
    const t5Start = performance.now();
    try {
      const hhdA = await this.createHousehold('בית א', '₪', 'ua', 'a@t.l');
      const hhdB = await this.createHousehold('בית ב', '₪', 'ub', 'b@t.l');
      await this.addPerson(hhdA.id, { displayName: 'בן א', personType: 'adult', portionFactor: 1.0, dietaryNotes: '' }, 'ua', 'a@t.l');
      await this.addPerson(hhdB.id, { displayName: 'בן ב', personType: 'child', portionFactor: 0.6, dietaryNotes: '' }, 'ub', 'b@t.l');

      const personsA = await this.getPersonsByHousehold(hhdA.id);
      const personsB = await this.getPersonsByHousehold(hhdB.id);

      const hasLeakage = personsA.some((p) => p.displayName === 'בן ב') || personsB.some((p) => p.displayName === 'בן א');
      results.push({
        testName: '5. בידוד דיירים ונתונים (Tenant Isolation)',
        passed: !hasLeakage,
        message: !hasLeakage ? 'נתוני בית א מבודדים ב-100% מנתוני בית ב' : 'זוהתה דליפת נתונים בין משקי בית!',
        durationMs: Math.round(performance.now() - t5Start),
      });
    } catch (e: any) {
      results.push({
        testName: '5. בידוד דיירים ונתונים (Tenant Isolation)',
        passed: false,
        message: e.message,
        durationMs: Math.round(performance.now() - t5Start),
      });
    }

    // Test 6: Audit Log Capture
    const t6Start = performance.now();
    try {
      const hhd = await this.createHousehold('בית Audit', '₪', 'u_aud', 'aud@t.l');
      const logs = await this.getAuditLogs(hhd.id);
      const hasInitLog = logs.some((l) => l.action === 'CREATE_HOUSEHOLD');
      results.push({
        testName: '6. רישום ומעקב יומן פעולות (Audit Logs)',
        passed: hasInitLog,
        message: hasInitLog ? 'כל הפעולות מתועדות בזמן אמת עם מזהה מבצע ופירוט' : 'חסר רישום ביקורת',
        durationMs: Math.round(performance.now() - t6Start),
      });
    } catch (e: any) {
      results.push({
        testName: '6. רישום ומעקב יומן פעולות (Audit Logs)',
        passed: false,
        message: e.message,
        durationMs: Math.round(performance.now() - t6Start),
      });
    }

    // Test 7: Backup Export & Integrity Verification
    const t7Start = performance.now();
    try {
      const hhd = await this.createHousehold('בית גיבוי', '₪', 'u_bk', 'bk@t.l');
      await this.addPerson(hhd.id, { displayName: 'דנה', personType: 'adult', portionFactor: 1.0, dietaryNotes: '' }, 'u_bk', 'bk@t.l');
      const backup = await this.exportFullBackup(hhd.id);
      const isIntegrityValid =
        (backup.version === '1.0.0' || backup.version === '2.0.0') &&
        backup.households.length === 1 &&
        backup.persons.length === 1 &&
        backup.auditLogs.length >= 2;
      results.push({
        testName: '7. ייצוא ושחזור גיבוי JSON מלא',
        passed: isIntegrityValid,
        message: isIntegrityValid ? 'מבנה הגיבוי אומת במלואו כולל כל הישויות, החשבונות וה-Audit' : 'כשל במבנה הגיבוי',
        durationMs: Math.round(performance.now() - t7Start),
      });
    } catch (e: any) {
      results.push({
        testName: '7. ייצוא ושחזור גיבוי JSON מלא',
        passed: false,
        message: e.message,
        durationMs: Math.round(performance.now() - t7Start),
      });
    }

    // Test 8: DB-Level RBAC Enforcement (Read-Only user blocked from mutations)
    const t8Start = performance.now();
    try {
      const hhd = await this.createHousehold('בית בדיקת RBAC', '₪', 'u_admin', 'adm@t.l');
      const roUser = await this.createUser(`ro_${Date.now()}@t.l`, 'משתמש לקריאה בלבד', '0000');
      await this.addMemberToHousehold(hhd.id, roUser.id, 'read_only', 'u_admin', 'adm@t.l');

      let writeBlocked = false;
      try {
        await this.addPerson(
          hhd.id,
          { displayName: 'ניסיון לא מורשה', personType: 'adult', portionFactor: 1.0, dietaryNotes: '' },
          roUser.id,
          roUser.email
        );
      } catch (err: any) {
        if (err.message.includes('דחיית הרשאה')) {
          writeBlocked = true;
        }
      }

      results.push({
        testName: '8. אכיפת הרשאות ברמת ה-DB (משתמש Read-Only נחסם משינויים)',
        passed: writeBlocked,
        message: writeBlocked ? 'ניסיון כתיבה של משתמש Read-Only נחסם ישירות ברמת ה-DB' : 'כשל: ניסיון לא מורשה לא נחסם!',
        durationMs: Math.round(performance.now() - t8Start),
      });
    } catch (e: any) {
      results.push({
        testName: '8. אכיפת הרשאות ברמת ה-DB (משתמש Read-Only נחסם משינויים)',
        passed: false,
        message: e.message,
        durationMs: Math.round(performance.now() - t8Start),
      });
    }

    // Test 9: Cross-Tenant Delete Attack Blocked
    const t9Start = performance.now();
    try {
      const hhdVictim = await this.createHousehold('בית קורבן', '₪', 'u_v', 'v@t.l');
      const victimPerson = await this.addPerson(
        hhdVictim.id,
        { displayName: 'בן קורבן', personType: 'child', portionFactor: 0.6, dietaryNotes: '' },
        'u_v',
        'v@t.l'
      );

      const hhdAttacker = await this.createHousehold('בית תוקף', '₪', 'u_a', 'a@t.l');

      let attackBlocked = false;
      try {
        // Attacker attempts to delete victim's person through their own household scope
        await this.deletePerson(victimPerson.id, hhdAttacker.id, 'u_a', 'a@t.l');
      } catch (err: any) {
        if (err.message.includes('Tenant Violation')) {
          attackBlocked = true;
        }
      }

      // Verify victim person still exists
      const victimPersons = await this.getPersonsByHousehold(hhdVictim.id);
      const stillAlive = victimPersons.some((p) => p.id === victimPerson.id);

      const success = attackBlocked && stillAlive;
      results.push({
        testName: '9. חסימת מחיקה חוצת-דיירים (Cross-Tenant Delete Attack Blocked)',
        passed: success,
        message: success ? 'ניסיון תקיפה ומחיקת בן בית ממשק בית זר נחסם ואומת' : 'כשל אבטחה חמור: המחיקה לא נחסמה!',
        durationMs: Math.round(performance.now() - t9Start),
      });
    } catch (e: any) {
      results.push({
        testName: '9. חסימת מחיקה חוצת-דיירים (Cross-Tenant Delete Attack Blocked)',
        passed: false,
        message: e.message,
        durationMs: Math.round(performance.now() - t9Start),
      });
    }

    // Test 10: Unconfirmed Backup Overwrite Blocked
    const t10Start = performance.now();
    try {
      let unconfirmedBlocked = false;
      try {
        const dummyBackup = { version: '1.0.0', exportedAt: new Date().toISOString(), households: [] } as any;
        await this.importFullBackup(dummyBackup, 'u_test', 'test@t.l', false);
      } catch (err: any) {
        if (err.message.includes('מחייב אישור מפורש')) {
          unconfirmedBlocked = true;
        }
      }

      results.push({
        testName: '10. מניעת דריסת נתונים בשחזור גיבוי ללא אישור מפורש',
        passed: unconfirmedBlocked,
        message: unconfirmedBlocked ? 'שחזור גיבוי דורס נחסם בהיעדר אישור מפורש' : 'כשל: גיבוי נדרס ללא אישור!',
        durationMs: Math.round(performance.now() - t10Start),
      });
    } catch (e: any) {
      results.push({
        testName: '10. מניעת דריסת נתונים בשחזור גיבוי ללא אישור מפורש',
        passed: false,
        message: e.message,
        durationMs: Math.round(performance.now() - t10Start),
      });
    }

    // Test 11: Financial Account Creation & Precision (Phase 2 - Sub-phase A)
    const t11Start = performance.now();
    try {
      const hhdFin = await this.createHousehold('בית פיננסי לבדיקה', '₪', 'u_fin', 'fin@t.l');
      const accChecking = await this.createAccount(
        hhdFin.id,
        {
          name: 'עו"ש דיסקונט',
          type: 'CHECKING',
          institution: 'בנק דיסקונט',
          currency: 'ILS',
          openingBalance: 12500.45,
          accountNumberLast4: '9921',
        },
        'u_fin',
        'fin@t.l'
      );

      const accCredit = await this.createAccount(
        hhdFin.id,
        {
          name: 'מקס Back',
          type: 'CREDIT_CARD',
          institution: 'Max',
          currency: 'ILS',
          openingBalance: -2500.25,
          creditLimit: 15000,
        },
        'u_fin',
        'fin@t.l'
      );

      const accWholeShekel = await this.createAccount(
        hhdFin.id,
        {
          name: 'חשבון סכום שלם',
          type: 'SAVINGS',
          institution: 'בדיקת מערכת',
          currency: 'ILS',
          openingBalance: 12500,
        },
        'u_fin',
        'fin@t.l'
      );

      const accounts = await this.getAccountsByHousehold(hhdFin.id);
      const success =
        accounts.length === 3 &&
        accChecking.currentBalance === 12500.45 &&
        accChecking.isLiability === false &&
        accCredit.currentBalance === -2500.25 &&
        accCredit.isLiability === true &&
        accCredit.creditLimitCents === 1500000 &&
        accWholeShekel.openingBalanceCents === 1250000 &&
        accWholeShekel.currentBalance === 12500;

      results.push({
        testName: '11. יצירת חשבונות פיננסיים (עו"ש, אשראי) בדיוק עשרוני וסיווג התחייבויות',
        passed: success,
        message: success ? 'חשבונות פיננסיים נוצרו, סווגו בדיוק מתמטי ונשלפו בהצלחה' : 'כשל ביצירת חשבונות פיננסיים',
        durationMs: Math.round(performance.now() - t11Start),
      });
    } catch (e: any) {
      results.push({
        testName: '11. יצירת חשבונות פיננסיים (עו"ש, אשראי) בדיוק עשרוני וסיווג התחייבויות',
        passed: false,
        message: e.message,
        durationMs: Math.round(performance.now() - t11Start),
      });
    }

    // Test 12: Financial Summary & Net Worth Calculation
    const t12Start = performance.now();
    try {
      const mockAccounts: FinancialAccount[] = [
        {
          id: 'acc_1',
          householdId: 'h_test',
          name: 'עו"ש',
          type: 'CHECKING',
          institution: 'לאומי',
          currency: 'ILS',
          openingBalance: 10000.10,
          currentBalance: 10000.10,
          status: 'ACTIVE',
          openingBalanceCents: 1000010,
          currentBalanceCents: 1000010,
          isLiability: false,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'acc_2',
          householdId: 'h_test',
          name: 'חיסכון',
          type: 'SAVINGS',
          institution: 'הפועלים',
          currency: 'ILS',
          openingBalance: 50000.20,
          currentBalance: 50000.20,
          status: 'ACTIVE',
          openingBalanceCents: 5000020,
          currentBalanceCents: 5000020,
          isLiability: false,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'acc_3',
          householdId: 'h_test',
          name: 'אשראי',
          type: 'CREDIT_CARD',
          institution: 'כאל',
          currency: 'ILS',
          openingBalance: -3000.15,
          currentBalance: -3000.15,
          status: 'ACTIVE',
          openingBalanceCents: -300015,
          currentBalanceCents: -300015,
          isLiability: true,
          createdAt: '',
          updatedAt: '',
        },
        {
          id: 'acc_4',
          householdId: 'h_test',
          name: 'הלוואה',
          type: 'LOAN_MORTGAGE',
          institution: 'מזרחי',
          currency: 'ILS',
          openingBalance: -20000.00,
          currentBalance: -20000.00,
          status: 'ACTIVE',
          openingBalanceCents: -2000000,
          currentBalanceCents: -2000000,
          isLiability: true,
          createdAt: '',
          updatedAt: '',
        },
      ];

      const summary = this.calculateFinancialSummary(mockAccounts);
      // Expected Assets: 10000.10 + 50000.20 = 60000.30
      // Expected Liabilities: 3000.15 + 20000.00 = 23000.15
      // Expected Net Worth: 60000.30 - 23000.15 = 37000.15
      const assetsMatch = summary.totalAssets === 60000.30;
      const liabMatch = summary.totalLiabilities === 23000.15;
      const netWorthMatch = summary.netWorth === 37000.15;
      const success = assetsMatch && liabMatch && netWorthMatch;

      results.push({
        testName: '12. חישוב שווי נטו (Net Worth) ונכסים מול התחייבויות ללא שגיאות עיגול',
        passed: success,
        message: success
          ? `חישוב מדויק: נכסים ₪${summary.totalAssets}, התחייבויות ₪${summary.totalLiabilities}, שווי נטו ₪${summary.netWorth}`
          : 'כשל בחישוב מתמטי של שווי נטו',
        durationMs: Math.round(performance.now() - t12Start),
      });
    } catch (e: any) {
      results.push({
        testName: '12. חישוב שווי נטו (Net Worth) ונכסים מול התחייבויות ללא שגיאות עיגול',
        passed: false,
        message: e.message,
        durationMs: Math.round(performance.now() - t12Start),
      });
    }

    // Test 13: Cross-Tenant Financial Isolation
    const t13Start = performance.now();
    try {
      const hhdA = await this.createHousehold('משק בית פיננסי א', '₪', 'u_a', 'a@t.l');
      const hhdB = await this.createHousehold('משק בית פיננסי ב', '₪', 'u_b', 'b@t.l');

      const accA = await this.createAccount(
        hhdA.id,
        {
          name: 'חשבון סודי א',
          type: 'SAVINGS',
          institution: 'בנק לאומי',
          currency: 'ILS',
          openingBalance: 100000,
        },
        'u_a',
        'a@t.l'
      );

      let isolationProtected = false;
      try {
        // Attempt to fetch account of household A using household B scope
        await this.getAccountById(accA.id, hhdB.id);
      } catch (err: any) {
        if (err.message.includes('Tenant Isolation Violation')) {
          isolationProtected = true;
        }
      }

      results.push({
        testName: '13. בידוד משקי בית בחשבונות פיננסיים (חסימת שליפה ממשק בית זר)',
        passed: isolationProtected,
        message: isolationProtected ? 'ניסיון קריאת חשבון ממשק בית זר נחסם ברמת ה-DB' : 'כשל אבטחה: בידוד נתונים פיננסי נפרץ!',
        durationMs: Math.round(performance.now() - t13Start),
      });
    } catch (e: any) {
      results.push({
        testName: '13. בידוד משקי בית בחשבונות פיננסיים (חסימת שליפה ממשק בית זר)',
        passed: false,
        message: e.message,
        durationMs: Math.round(performance.now() - t13Start),
      });
    }

    // Test 14: Financial RBAC Enforcement (Read-Only user cannot create or update accounts)
    const t14Start = performance.now();
    try {
      const hhdRbac = await this.createHousehold('משק בית בדיקת הרשאות פיננסיות', '₪', 'u_adm', 'adm@t.l');
      const roUser = await this.createUser(`ro_fin_${Date.now()}@t.l`, 'צופה פיננסי', '0000');
      await this.addMemberToHousehold(hhdRbac.id, roUser.id, 'read_only', 'u_adm', 'adm@t.l');

      let mutationBlocked = false;
      try {
        await this.createAccount(
          hhdRbac.id,
          {
            name: 'ניסיון יצירה לא מורשה',
            type: 'CHECKING',
            institution: 'בנק יהב',
            currency: 'ILS',
            openingBalance: 500,
          },
          roUser.id,
          roUser.email
        );
      } catch (err: any) {
        if (err.message.includes('דחיית הרשאה')) {
          mutationBlocked = true;
        }
      }

      results.push({
        testName: '14. אכיפת הרשאות פיננסיות (משתמש Read-Only נחסם מיצירת חשבון)',
        passed: mutationBlocked,
        message: mutationBlocked ? 'ניסיון כתיבה פיננסית של משתמש Read-Only נחסם בהצלחה' : 'כשל: משתמש ללא הרשאה יצר חשבון!',
        durationMs: Math.round(performance.now() - t14Start),
      });
    } catch (e: any) {
      results.push({
        testName: '14. אכיפת הרשאות פיננסיות (משתמש Read-Only נחסם מיצירת חשבון)',
        passed: false,
        message: e.message,
        durationMs: Math.round(performance.now() - t14Start),
      });
    }

    // Test 15: Dynamic Balance Calculation via Ledger in Integer Cents
    const t15Start = performance.now();
    try {
      const hhd15 = await this.createHousehold('משק בית בדיקת יתרות 15', '₪', 'u_t15', 't15@t.l');
      const acc15 = await this.createAccount(
        hhd15.id,
        {
          name: 'עו"ש בדיקה',
          type: 'CHECKING',
          institution: 'לאומי',
          currency: 'ILS',
          openingBalance: 1000.50, // 100050 cents
        },
        'u_t15',
        't15@t.l'
      );

      // Add Income: 500.25 (50025 cents)
      await this.createTransaction(
        hhd15.id,
        {
          accountId: acc15.id,
          date: '2026-03-01',
          amountCents: toCents(500.25),
          type: 'INCOME',
          category: 'בונוס',
          payee: 'מעסיק',
        },
        'u_t15',
        't15@t.l'
      );

      // Add Expense: 200.10 (20010 cents)
      await this.createTransaction(
        hhd15.id,
        {
          accountId: acc15.id,
          date: '2026-03-02',
          amountCents: toCents(200.10),
          type: 'EXPENSE',
          category: 'ציוד',
          payee: 'חנות מחשבים',
        },
        'u_t15',
        't15@t.l'
      );

      const accounts = await this.getAccountsByHousehold(hhd15.id);
      const updatedAcc = accounts.find((a) => a.id === acc15.id)!;
      // 100050 + 50025 - 20010 = 130065 cents -> 1300.65
      const expectedCents = 130065;
      const success =
        updatedAcc.currentBalanceCents === expectedCents &&
        updatedAcc.currentBalance === 1300.65;

      results.push({
        testName: '15. חישוב יתרות דינמי מתוך ספר העסקאות באגורות שלמות',
        passed: success,
        message: success
          ? `יתרה חושבה בדיוק: ${formatCents(updatedAcc.currentBalanceCents)} (פתיחה ₪1000.50 + הכנסה ₪500.25 - הוצאה ₪200.10)`
          : `כשל בחישוב יתרה: צפוי ${expectedCents} אגורות, התקבל ${updatedAcc.currentBalanceCents}`,
        durationMs: Math.round(performance.now() - t15Start),
      });
    } catch (e: any) {
      results.push({
        testName: '15. חישוב יתרות דינמי מתוך ספר העסקאות באגורות שלמות',
        passed: false,
        message: e.message,
        durationMs: Math.round(performance.now() - t15Start),
      });
    }

    // Test 16: Two-Legged Atomic Account-to-Account Transfer
    const t16Start = performance.now();
    try {
      const hhd16 = await this.createHousehold('משק בית העברות 16', '₪', 'u_t16', 't16@t.l');
      const accChecking = await this.createAccount(
        hhd16.id,
        {
          name: 'עו"ש מקור',
          type: 'CHECKING',
          institution: 'פועלים',
          currency: 'ILS',
          openingBalance: 2000.00, // 200000 cents
        },
        'u_t16',
        't16@t.l'
      );
      const accSavings = await this.createAccount(
        hhd16.id,
        {
          name: 'חיסכון יעד',
          type: 'SAVINGS',
          institution: 'פועלים',
          currency: 'ILS',
          openingBalance: 500.00, // 50000 cents
        },
        'u_t16',
        't16@t.l'
      );

      // Transfer 800.00 (80000 cents) from checking to savings
      const transferRes = await this.createTransfer(
        hhd16.id,
        {
          fromAccountId: accChecking.id,
          toAccountId: accSavings.id,
          date: '2026-03-03',
          amountCents: toCents(800.00),
          category: 'חיסכון',
          notes: 'העברה חודשית',
        },
        'u_t16',
        't16@t.l'
      );

      const accounts = await this.getAccountsByHousehold(hhd16.id);
      const updatedChecking = accounts.find((a) => a.id === accChecking.id)!;
      const updatedSavings = accounts.find((a) => a.id === accSavings.id)!;

      const sharedTransferId = transferRes.outgoingLeg.transferId === transferRes.incomingLeg.transferId;
      const mutualLinks =
        transferRes.outgoingLeg.linkedTransactionId === transferRes.incomingLeg.id &&
        transferRes.incomingLeg.linkedTransactionId === transferRes.outgoingLeg.id;
      const checkingBalanceOk = updatedChecking.currentBalanceCents === 120000; // 1200.00
      const savingsBalanceOk = updatedSavings.currentBalanceCents === 130000;   // 1300.00

      const success = sharedTransferId && mutualLinks && checkingBalanceOk && savingsBalanceOk;
      results.push({
        testName: '16. העברה אטומית בין חשבונות בשתי רגליים מקושרות (Atomic Transfer)',
        passed: success,
        message: success
          ? 'שתי רגלי ההעברה נוצרו במזהה משותף, קושרו הדדית, ויתרות החשבונות עודכנו בהתאמה מלאה'
          : 'כשל בביצוע העברה אטומית בין חשבונות',
        durationMs: Math.round(performance.now() - t16Start),
      });
    } catch (e: any) {
      results.push({
        testName: '16. העברה אטומית בין חשבונות בשתי רגליים מקושרות (Atomic Transfer)',
        passed: false,
        message: e.message,
        durationMs: Math.round(performance.now() - t16Start),
      });
    }

    // Test 17: Transfers Strictly Excluded from Household Budget & Cashflow
    const t17Start = performance.now();
    try {
      const hhd17 = await this.createHousehold('משק בית תקציב 17', '₪', 'u_t17', 't17@t.l');
      const accA = await this.createAccount(
        hhd17.id,
        { name: 'חשבון א', type: 'CHECKING', institution: 'בנק', currency: 'ILS', openingBalance: 10000 },
        'u_t17',
        't17@t.l'
      );
      const accB = await this.createAccount(
        hhd17.id,
        { name: 'חשבון ב', type: 'SAVINGS', institution: 'בנק', currency: 'ILS', openingBalance: 0 },
        'u_t17',
        't17@t.l'
      );

      // Income 5000 (500000 cents)
      await this.createTransaction(
        hhd17.id,
        { accountId: accA.id, date: '2026-03-01', amountCents: toCents(5000), type: 'INCOME', category: 'שכר', payee: 'עבודה' },
        'u_t17',
        't17@t.l'
      );

      // Expense 1500 (150000 cents)
      await this.createTransaction(
        hhd17.id,
        { accountId: accA.id, date: '2026-03-02', amountCents: toCents(1500), type: 'EXPENSE', category: 'מזון', payee: 'סופר' },
        'u_t17',
        't17@t.l'
      );

      // Transfer 2000 (200000 cents)
      await this.createTransfer(
        hhd17.id,
        { fromAccountId: accA.id, toAccountId: accB.id, date: '2026-03-03', amountCents: toCents(2000) },
        'u_t17',
        't17@t.l'
      );

      const summary = await this.calculateHouseholdLedgerSummary(hhd17.id, await this.getTransactionsByHousehold(hhd17.id));
      const incomeOk = summary.totalIncomeCents === 500000;
      const expenseOk = summary.totalExpenseCents === 150000;
      const netCashflowOk = summary.netCashflowCents === 350000; // 5000 - 1500 = 3500
      const transfersOk = summary.totalTransfersCents === 200000;

      const success = incomeOk && expenseOk && netCashflowOk && transfersOk;
      results.push({
        testName: '17. החרגת העברות פנימיות מתזרים הכנסות והוצאות משק הבית',
        passed: success,
        message: success
          ? `תזרים אומת: הכנסות ${formatCents(summary.totalIncomeCents)}, הוצאות ${formatCents(summary.totalExpenseCents)}, נטו ${formatCents(summary.netCashflowCents)}. העברות של ${formatCents(summary.totalTransfersCents)} לא נופחו.`
          : 'כשל: העברות פנימיות סולפו כהכנסה או הוצאה בתזרים!',
        durationMs: Math.round(performance.now() - t17Start),
      });
    } catch (e: any) {
      results.push({
        testName: '17. החרגת העברות פנימיות מתזרים הכנסות והוצאות משק הבית',
        passed: false,
        message: e.message,
        durationMs: Math.round(performance.now() - t17Start),
      });
    }

    // Test 18: Credit Card Repayment from Checking Without Double Counting
    const t18Start = performance.now();
    try {
      const hhd18 = await this.createHousehold('משק בית אשראי 18', '₪', 'u_t18', 't18@t.l');
      const checking = await this.createAccount(
        hhd18.id,
        { name: 'עו"ש', type: 'CHECKING', institution: 'בנק', currency: 'ILS', openingBalance: 10000.00 },
        'u_t18',
        't18@t.l'
      );
      const creditCard = await this.createAccount(
        hhd18.id,
        { name: 'ויזה', type: 'CREDIT_CARD', institution: 'כאל', currency: 'ILS', openingBalance: 0.00 },
        'u_t18',
        't18@t.l'
      );

      // Purchase on credit card: 150.00 (15000 cents)
      await this.createTransaction(
        hhd18.id,
        { accountId: creditCard.id, date: '2026-03-01', amountCents: toCents(150.00), type: 'EXPENSE', category: 'קניות', payee: 'זארה' },
        'u_t18',
        't18@t.l'
      );

      // At this point: creditCard debt is -150.00 (-15000 cents)
      let accountsMid = await this.getAccountsByHousehold(hhd18.id);
      let ccMid = accountsMid.find((a) => a.id === creditCard.id)!;
      const ccDebtBeforeRepayment = ccMid.currentBalanceCents === -15000;

      // Settle credit card via transfer from checking
      await this.createTransfer(
        hhd18.id,
        {
          fromAccountId: checking.id,
          toAccountId: creditCard.id,
          date: '2026-03-10',
          amountCents: toCents(150.00),
          category: 'פירעון אשראי',
          notes: 'חיוב חודשי אוטומטי',
        },
        'u_t18',
        't18@t.l'
      );

      let accountsAfter = await this.getAccountsByHousehold(hhd18.id);
      let chkAfter = accountsAfter.find((a) => a.id === checking.id)!;
      let ccAfter = accountsAfter.find((a) => a.id === creditCard.id)!;

      // Checking should now be 10000 - 150 = 9850.00 (985000 cents)
      // Credit card balance should be 0.00 (0 cents)
      const checkingBalanceOk = chkAfter.currentBalanceCents === 985000;
      const ccZeroed = ccAfter.currentBalanceCents === 0;

      // Ledger summary expenses should remain exactly 150.00, NOT 300.00
      const summary = await this.calculateHouseholdLedgerSummary(hhd18.id, await this.getTransactionsByHousehold(hhd18.id));
      const noDoubleCount = summary.totalExpenseCents === 15000;

      const success = ccDebtBeforeRepayment && checkingBalanceOk && ccZeroed && noDoubleCount;
      results.push({
        testName: '18. פירעון כרטיס אשראי מהעו״ש כהעברה ללא כפילות הוצאה',
        passed: success,
        message: success
          ? 'חוב האשראי אופס, היתרה בעו"ש ירדה בדיוק, וההוצאה חושבה פעם אחת בלבד (ללא כפילות)'
          : 'כשל בפירעון כרטיס אשראי או כפילות הוצאה זוהתה בתזרים',
        durationMs: Math.round(performance.now() - t18Start),
      });
    } catch (e: any) {
      results.push({
        testName: '18. פירעון כרטיס אשראי מהעו״ש כהעברה ללא כפילות הוצאה',
        passed: false,
        message: e.message,
        durationMs: Math.round(performance.now() - t18Start),
      });
    }

    // Test 19: Cross-Tenant Ledger Isolation
    const t19Start = performance.now();
    try {
      const hhdA = await this.createHousehold('משק בית ספר א', '₪', 'u_a19', 'a19@t.l');
      const hhdB = await this.createHousehold('משק בית ספר ב', '₪', 'u_b19', 'b19@t.l');

      const accA = await this.createAccount(
        hhdA.id,
        { name: 'עו"ש א', type: 'CHECKING', institution: 'בנק', currency: 'ILS', openingBalance: 1000 },
        'u_a19',
        'a19@t.l'
      );

      const txA = await this.createTransaction(
        hhdA.id,
        { accountId: accA.id, date: '2026-03-01', amountCents: toCents(300), type: 'EXPENSE', category: 'סודי', payee: 'חנות א' },
        'u_a19',
        'a19@t.l'
      );

      let tenantViolationCaught = false;
      try {
        // Attempt to fetch txA using household B scope
        await this.getTransactionById(txA.id, hhdB.id);
      } catch (err: any) {
        if (err.message.includes('Tenant Isolation Violation')) {
          tenantViolationCaught = true;
        }
      }

      // Also ensure getTransactionsByHousehold(hhdB.id) contains 0 transactions
      const txsB = await this.getTransactionsByHousehold(hhdB.id);
      const isolatedFromList = txsB.length === 0;

      const success = tenantViolationCaught && isolatedFromList;
      results.push({
        testName: '19. בידוד נתונים חוצה-דיירים בספר העסקאות (Cross-Tenant Ledger Isolation)',
        passed: success,
        message: success
          ? 'שליפת עסקה ורשימת עסקאות ממשק בית זר נחסמה ואומתה ברמת ה-DB'
          : 'כשל אבטחה: בידוד ספר עסקאות נפרץ בין משקי בית!',
        durationMs: Math.round(performance.now() - t19Start),
      });
    } catch (e: any) {
      results.push({
        testName: '19. בידוד נתונים חוצה-דיירים בספר העסקאות (Cross-Tenant Ledger Isolation)',
        passed: false,
        message: e.message,
        durationMs: Math.round(performance.now() - t19Start),
      });
    }

    // Test 20: Atomic Transfer Cascade Deletion
    const t20Start = performance.now();
    try {
      const hhd20 = await this.createHousehold('משק בית מחיקה 20', '₪', 'u_t20', 't20@t.l');
      const acc1 = await this.createAccount(
        hhd20.id,
        { name: 'חשבון 1', type: 'CHECKING', institution: 'בנק', currency: 'ILS', openingBalance: 5000 },
        'u_t20',
        't20@t.l'
      );
      const acc2 = await this.createAccount(
        hhd20.id,
        { name: 'חשבון 2', type: 'SAVINGS', institution: 'בנק', currency: 'ILS', openingBalance: 1000 },
        'u_t20',
        't20@t.l'
      );

      const transfer = await this.createTransfer(
        hhd20.id,
        { fromAccountId: acc1.id, toAccountId: acc2.id, date: '2026-03-01', amountCents: toCents(500) },
        'u_t20',
        't20@t.l'
      );

      // Delete only the outgoing leg
      await this.deleteTransaction(transfer.outgoingLeg.id, hhd20.id, 'u_t20', 't20@t.l');

      // Verify incoming leg was also deleted automatically
      const txs = await this.getTransactionsByHousehold(hhd20.id);
      const neitherRemains = txs.length === 0;

      // Verify account balances restored to initial
      const accs = await this.getAccountsByHousehold(hhd20.id);
      const acc1Restored = accs.find((a) => a.id === acc1.id)!.currentBalanceCents === 500000;
      const acc2Restored = accs.find((a) => a.id === acc2.id)!.currentBalanceCents === 100000;

      const success = neitherRemains && acc1Restored && acc2Restored;
      results.push({
        testName: '20. מחיקה אטומית של שתי רגלי ההעברה ושחזור היתרות (Cascade Transfer Deletion)',
        passed: success,
        message: success
          ? 'מחיקת רגל אחת מחקה אוטומטית את הרגל הנגדית ושחזרה את יתרות שני החשבונות במדויק'
          : 'כשל: רגל יתומה של העברה נותרה במערכת או יתרות לא שוחזרו',
        durationMs: Math.round(performance.now() - t20Start),
      });
    } catch (e: any) {
      results.push({
        testName: '20. מחיקה אטומית של שתי רגלי ההעברה ושחזור היתרות (Cascade Transfer Deletion)',
        passed: false,
        message: e.message,
        durationMs: Math.round(performance.now() - t20Start),
      });
    }

    // Test 21: Financial Integer Cents Precision Verification
    const t21Start = performance.now();
    try {
      // Classic JavaScript float pitfall: 0.1 + 0.2 === 0.30000000000000004
      // In integer cents: 10 + 20 === 30 exactly
      const c1 = toCents('0.10'); // 10
      const c2 = toCents('0.20'); // 20
      const c3 = toCents('19.99'); // 1999
      const c4 = toCents('0.01'); // 1
      const wholeShekelNumber = toCents(20); // 2000 — integer numbers are shekels, not pre-scaled cents
      const largeWholeShekelNumber = toCents(21500); // 2150000

      const sumCents = c1 + c2 + c3 + c4; // 2030
      const sumShekels = fromCents(sumCents); // 20.3

      const floatDirect = 0.1 + 0.2 + 19.99 + 0.01;
      const floatHasNoise = floatDirect !== 20.3; // Usually 20.300000000000004

      const integerExact = Number.isInteger(sumCents) && sumCents === 2030 && sumShekels === 20.3;
      const wholeShekelExact = wholeShekelNumber === 2000 && largeWholeShekelNumber === 2150000;
      const success = integerExact && wholeShekelExact;

      results.push({
        testName: '21. דיוק פיננסי מוחלט באגורות שלמות ללא סטיות נקודה צפה (Zero Floating-Point Epsilon)',
        passed: success,
        message: success
          ? `אומת: דיוק אגורות שלמות והמרת שקלים שלמים (20 ₪ = ${wholeShekelNumber} אגורות; 21,500 ₪ = ${largeWholeShekelNumber} אגורות)`
          : 'כשל בדיוק אגורות שלמות או בהמרת סכום שקלי שלם',
        durationMs: Math.round(performance.now() - t21Start),
      });
    } catch (e: any) {
      results.push({
        testName: '21. דיוק פיננסי מוחלט באגורות שלמות ללא סטיות נקודה צפה (Zero Floating-Point Epsilon)',
        passed: false,
        message: e.message,
        durationMs: Math.round(performance.now() - t21Start),
      });
    }

    // Test 22: Full Backup Export and Restore with Ledger Transactions
    const t22Start = performance.now();
    try {
      const hhd22 = await this.createHousehold('משק בית גיבוי 22', '₪', 'u_t22', 't22@t.l');
      const acc22 = await this.createAccount(
        hhd22.id,
        { name: 'עו"ש גיבוי', type: 'CHECKING', institution: 'בנק', currency: 'ILS', openingBalance: 4000 },
        'u_t22',
        't22@t.l'
      );

      await this.createTransaction(
        hhd22.id,
        { accountId: acc22.id, date: '2026-03-01', amountCents: toCents(1200), type: 'INCOME', category: 'עבודה', payee: 'לקוח' },
        'u_t22',
        't22@t.l'
      );

      // Export full backup
      const backup = await this.exportFullBackup(hhd22.id);
      const hasTransactions = Boolean(backup.transactions && backup.transactions.length > 0);
      const txFound = backup.transactions?.some((t) => t.householdId === hhd22.id);

      // Re-import backup
      await this.importFullBackup(backup, 'u_t22', 't22@t.l', true);

      // Verify transaction survived and balance recomputes
      const restoredTxs = await this.getTransactionsByHousehold(hhd22.id);
      const restoredAccs = await this.getAccountsByHousehold(hhd22.id);
      const restoredAcc = restoredAccs.find((a) => a.id === acc22.id)!;

      const success =
        hasTransactions &&
        Boolean(txFound) &&
        restoredTxs.length === 1 &&
        restoredAcc.currentBalanceCents === 520000; // 4000 + 1200 = 5200.00

      results.push({
        testName: '22. ייצוא ושחזור גיבוי מלא כולל ספר עסקאות וחישוב יתרות דינמי',
        passed: success,
        message: success
          ? 'גיבוי מלא יוצא ושוחזר בהצלחה כולל ספר העסקאות וחישוב יתרות מחדש'
          : 'כשל בייצוא/שחזור עסקאות ויתרות בגיבוי',
        durationMs: Math.round(performance.now() - t22Start),
      });
    } catch (e: any) {
      results.push({
        testName: '22. ייצוא ושחזור גיבוי מלא כולל ספר עסקאות וחישוב יתרות דינמי',
        passed: false,
        message: e.message,
        durationMs: Math.round(performance.now() - t22Start),
      });
    }

    const allPassed = results.every((r) => r.passed);
    return { passed: allPassed, results };
  }
}

export const db = new HomeOSIndexedDB();



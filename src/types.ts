/**
 * HOME OS — Phase 1 Domain Types & Interfaces
 * Modern Editorial Local-First Household Operating System
 */

export type Role = 'owner' | 'admin' | 'member' | 'read_only';

export type PersonType = 'adult' | 'child' | 'dependent';

export type DomainPermission = 'finance' | 'food' | 'documents' | 'assets' | 'planning' | 'admin';

export type PermissionLevel = 'read' | 'write' | 'approve' | 'none';

export interface User {
  id: string;
  email: string;
  fullName: string;
  pin?: string;
  avatarColor: string;
  createdAt: string;
}

export interface Household {
  id: string;
  name: string;
  currency: string;
  createdAt: string;
  settings: {
    theme: string;
    density: 'compact' | 'balanced' | 'spacious';
    viewMode: 'executive' | 'productivity' | 'analytics';
  };
}

export interface HouseholdMembership {
  id: string;
  householdId: string;
  userId: string;
  role: Role;
  joinedAt: string;
}

export interface HouseholdPerson {
  id: string;
  householdId: string;
  linkedUserId?: string; // Optional: Children/dependents have NO linked user account
  displayName: string;
  personType: PersonType;
  birthDate?: string;
  portionFactor: number; // For future food module: 1.0 adult, 0.6 child, etc.
  dietaryNotes: string;
  createdAt: string;
}

export interface HouseholdPermissionRule {
  id: string;
  membershipId: string;
  householdId: string;
  domain: DomainPermission;
  canRead: boolean;
  canWrite: boolean;
  canApprove: boolean;
}

export interface AuditLog {
  id: string;
  householdId: string;
  userId: string;
  userEmail: string;
  action: string;
  domain: string;
  details: string;
  timestamp: string;
}

// ============================================================
// Phase 2: Financial Foundation & Account Entities
// ============================================================

export type AccountType = 'CHECKING' | 'CREDIT_CARD' | 'SAVINGS' | 'LOAN_MORTGAGE';

export type AccountCurrency = 'ILS' | 'USD' | 'EUR' | 'GBP';

export type AccountStatus = 'ACTIVE' | 'ARCHIVED' | 'CLOSED';

export interface FinancialAccount {
  id: string;
  householdId: string;
  name: string;
  type: AccountType;
  institution: string;
  accountNumberLast4?: string;
  currency: AccountCurrency;
  openingBalanceCents: number; // Stored in strict integer cents (e.g. 1845000 = ₪18,450.00)
  openingBalance: number; // Computed/display helper in major units
  currentBalanceCents: number; // Dynamically computed from ledger transactions + openingBalanceCents
  currentBalance: number; // Dynamic computed display in major units
  status: AccountStatus;
  isLiability: boolean; // True for CREDIT_CARD, LOAN_MORTGAGE
  creditLimitCents?: number; // Optional limit in cents
  creditLimit?: number; // Optional limit for credit cards or overdraft
  interestRate?: number; // Optional annual interest % for savings or loans
  notes?: string;
  color?: string; // Modern Editorial color accent
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Phase 2 - Sub-phase B: Central Ledger & Transfers
// ============================================================

export type TransactionType = 'EXPENSE' | 'INCOME' | 'TRANSFER';
export type TransactionSource = 'MANUAL' | 'IMPORT';
export type VerificationStatus = 'VERIFIED' | 'PENDING' | 'RECONCILED';

export interface LedgerTransaction {
  id: string;
  householdId: string;
  accountId: string; // The specific account this transaction affects
  date: string; // YYYY-MM-DD
  valueDate?: string; // YYYY-MM-DD (optional תאריך ערך)
  amountCents: number; // Magnitude in integer cents (positive number > 0)
  type: TransactionType; // 'EXPENSE' | 'INCOME' | 'TRANSFER'
  category: string; // Category name (e.g. 'סופרמרקט ומזון', 'שכר דירה', 'העברה פנימית')
  payee: string; // Merchant / recipient / source (e.g. 'שופרסל', 'מעסיק')
  notes?: string;
  source: TransactionSource; // 'MANUAL' | 'IMPORT'
  verificationStatus: VerificationStatus; // 'VERIFIED' | 'PENDING' | 'RECONCILED'
  
  // Transfer-specific fields (for 2-legged transfers)
  transferId?: string; // Shared identifier linking both outgoing and incoming legs
  linkedTransactionId?: string; // Direct ID of the counter-leg transaction
  transferDirection?: 'OUT' | 'IN'; // 'OUT' (decrease balance) or 'IN' (increase balance)
  counterpartyAccountId?: string; // The opposite account involved in the transfer

  createdAt: string;
  updatedAt: string;
  createdBy: string; // userId
}

export interface BackupData {
  version: string;
  exportedAt: string;
  households: Household[];
  users: User[];
  memberships: HouseholdMembership[];
  persons: HouseholdPerson[];
  permissions: HouseholdPermissionRule[];
  auditLogs: AuditLog[];
  accounts?: FinancialAccount[];
  transactions?: LedgerTransaction[];
}

import {
  HomeOSData,
  DayPlan,
  Account,
  Transaction,
  CategoryBudget,
  DefaultShoppingCategory,
  RecipeDish,
  ShoppingItem,
} from '../types/homeos';
import { toCents } from '../utils/currency';

export const INITIAL_SHOPPING_CATEGORIES: readonly DefaultShoppingCategory[] = [
  'ירקות ופירות',
  'מוצרי חלב',
  'בשר ודגים',
  'מזווה ויבשים',
  'מאפים',
  'ניקיון ובית',
  'אחר',
] as const;

export function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getSundayOfWeek(d: Date): Date {
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = target.getDay();
  target.setDate(target.getDate() - day);
  return target;
}

export function isValidDateString(dateStr: unknown): dateStr is string {
  if (typeof dateStr !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split('-').map(Number);
  if (y < 1900 || y > 2100) return false;
  if (m < 1 || m > 12) return false;
  const daysInMonth = new Date(y, m, 0).getDate();
  if (d < 1 || d > daysInMonth) return false;
  return true;
}

export function createWeekDays(startSunday: Date): DayPlan[] {
  const daysHebrew = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
  return daysHebrew.map((dayName, idx) => {
    const d = new Date(startSunday.getFullYear(), startSunday.getMonth(), startSunday.getDate() + idx);
    return {
      date: formatLocalDate(d),
      dayName,
      breakfast: [],
      lunch: [],
      dinner: [],
    };
  });
}

export function generateUniqueId(prefix: string, existingIds?: Set<string>): string {
  let id = '';
  do {
    const randomPart = Math.random().toString(36).substring(2, 9);
    id = `${prefix}_${Date.now()}_${randomPart}`;
  } while (existingIds && existingIds.has(id));
  return id;
}

export function computeAccountBalances(accounts: Account[], transactions: Transaction[]): Account[] {
  return accounts.map((acc) => {
    let deltaCents = 0;
    transactions.forEach((tx) => {
      if (acc.openingBalanceDate && tx.date < acc.openingBalanceDate) return;
      if (tx.accountId === acc.id) {
        if (tx.type === 'INCOME') deltaCents += tx.amountCents;
        else if (tx.type === 'EXPENSE') deltaCents -= tx.amountCents;
        else if (tx.type === 'TRANSFER') deltaCents -= tx.amountCents;
      }
      if (tx.type === 'TRANSFER' && tx.toAccountId === acc.id) {
        deltaCents += tx.amountCents;
      }
    });
    return {
      ...acc,
      currentBalanceCents: acc.openingBalanceCents + deltaCents,
    };
  });
}

export function getCleanEmptyData(): HomeOSData {
  return {
    version: '1.0.0',
    householdName: 'משק הבית שלי',
    isDemoMode: false,
    accounts: [],
    transactions: [],
    budgets: [
      { category: 'מזון וסופרמרקט', monthlyLimitCents: toCents(4000) },
      { category: 'דיור וחשבונות', monthlyLimitCents: toCents(6000) },
      { category: 'תחבורה ודלק', monthlyLimitCents: toCents(1500) },
      { category: 'בילוי ופנאי', monthlyLimitCents: toCents(1200) },
    ],
    recipeDishes: [],
    weeklyPlan: createWeekDays(getSundayOfWeek(new Date())),
    shoppingList: [],
  };
}
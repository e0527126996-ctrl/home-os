export type AccountType = 'CHECKING' | 'CASH' | 'CREDIT_CARD' | 'SAVINGS' | (string & {});

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  institution: string;
  openingBalanceCents: number;
  openingBalanceDate: string;
  currentBalanceCents?: number;
  projectedBalanceCents?: number;
  isBalanceValid?: boolean;
  balanceCalculationError?: string;
  color: string;
}

export type TransactionType = 'INCOME' | 'EXPENSE' | 'TRANSFER' | (string & {});

export interface Transaction {
  id: string;
  date: string;
  amountCents: number;
  type: TransactionType;
  accountId: string;
  toAccountId?: string;
  category: string;
  payee: string;
  notes?: string;
  isAmbiguous?: boolean;
  ambiguityReason?: string;
}

export interface CategoryBudget {
  category: string;
  monthlyLimitCents: number;
  isInvalid?: boolean;
}

export type MealTime = 'breakfast' | 'lunch' | 'dinner' | (string & {});

export interface RecipeDish {
  id: string;
  name: string;
  category: string;
  defaultMeal: MealTime;
  ingredients: string[];
  notes?: string;
}

export interface DayPlan {
  date: string;
  dayName: string;
  breakfast: string[];
  lunch: string[];
  dinner: string[];
}

export type DefaultShoppingCategory =
  | 'ירקות ופירות'
  | 'מוצרי חלב'
  | 'בשר ודגים'
  | 'מזווה ויבשים'
  | 'מאפים'
  | 'ניקיון ובית'
  | 'אחר';

export type ShoppingCategory = DefaultShoppingCategory | (string & {});

export interface ShoppingItem {
  id: string;
  name: string;
  category: ShoppingCategory;
  checked: boolean;
  quantity?: string;
  fromMealPlan?: boolean;
}

export interface HomeOSData {
  version: string;
  householdName: string;
  isDemoMode: boolean;
  accounts: Account[];
  transactions: Transaction[];
  budgets: CategoryBudget[];
  recipeDishes: RecipeDish[];
  weeklyPlan: DayPlan[];
  shoppingList: ShoppingItem[];
}
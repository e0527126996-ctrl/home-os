/**
 * HOME OS — Financial Precision Engine
 * Uses STRICT integer cents representation (e.g. 10050 = ₪100.50).
 * Never relies on floating point math or Math.round(val * 100) / 100 for financial balances.
 */

/**
 * Converts a decimal string or number (e.g. "19.99", 19.99, "-50.00") into exact integer cents.
 * Prevents floating point artifacts like 19.99 * 100 = 1998.9999999999998.
 */
export function toCents(val: number | string | undefined | null): number {
  if (val === undefined || val === null || val === '') return 0;
  
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return 0;
    val = val.toFixed(2);
  }
  
  const str = String(val).trim();
  if (!str) return 0;

  const isNegative = str.startsWith('-');
  const clean = str.replace('-', '');
  const parts = clean.split('.');
  
  const wholePart = parseInt(parts[0] || '0', 10);
  const fracPartStr = (parts[1] || '').padEnd(2, '0').slice(0, 2);
  const fracPart = parseInt(fracPartStr || '0', 10);
  
  if (isNaN(wholePart) || isNaN(fracPart)) return 0;
  
  const totalCents = wholePart * 100 + fracPart;
  return isNegative ? -totalCents : totalCents;
}

/**
 * Converts integer cents back to a standard JavaScript decimal number for display.
 */
export function fromCents(cents: number): number {
  return Math.trunc(cents) / 100;
}

/**
 * Formats integer cents as a localized currency string with exact 2 decimal places.
 * e.g., 1845050 -> "₪18,450.50"
 */
export function formatCents(cents: number, currency: string = 'ILS'): string {
  const symbol = currency === 'ILS' ? '₪' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : '£';
  const isNegative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = (abs % 100).toString().padStart(2, '0');
  const formattedWhole = whole.toLocaleString('he-IL');
  return `${isNegative ? '-' : ''}${symbol}${formattedWhole}.${frac}`;
}

/**
 * Parses user input in currency form to cents, returning { valid: boolean, cents: number, error?: string }
 */
export function parseCurrencyInput(input: string): { valid: boolean; cents: number; error?: string } {
  const trimmed = input.trim().replace(/,/g, '');
  if (!trimmed) {
    return { valid: false, cents: 0, error: 'יש להזין סכום' };
  }
  if (!/^-?\d+(\.\d{1,2})?$/.test(trimmed)) {
    return { valid: false, cents: 0, error: 'סכום אינו חוקי (יש להזין ספרות ועד 2 ספרות אחרי הנקודה)' };
  }
  const cents = toCents(trimmed);
  return { valid: true, cents };
}
